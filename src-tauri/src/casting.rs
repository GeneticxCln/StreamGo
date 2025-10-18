/**
 * Casting Module
 *
 * Supports streaming to Chromecast, DLNA, and UPnP devices
 */
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::IpAddr,
    sync::Arc,
    time::Duration,
};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Supported casting protocols
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CastProtocol {
    Chromecast,
    DLNA,
    AirPlay,
}

/// Cast device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastDevice {
    pub id: String,
    pub name: String,
    pub protocol: CastProtocol,
    pub ip_address: String,
    pub port: u16,
    pub model: Option<String>,
    pub manufacturer: Option<String>,
    pub status: DeviceStatus,
}

/// Device connection status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DeviceStatus {
    Available,
    Connected,
    Playing,
    Paused,
    Buffering,
    Disconnected,
}

/// Cast session information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastSession {
    pub session_id: String,
    pub device_id: String,
    pub media_url: String,
    pub title: Option<String>,
    pub subtitle_url: Option<String>,
    pub position: f64,
    pub duration: f64,
    pub state: PlaybackState,
}

/// Playback state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum PlaybackState {
    Playing,
    Paused,
    Buffering,
    Idle,
}

/// Cast manager handling device discovery and sessions
pub struct CastManager {
    devices: Arc<RwLock<HashMap<String, CastDevice>>>,
    sessions: Arc<RwLock<HashMap<String, CastSession>>>,
    local_ip: String,
    streaming_port: u16,
}

impl CastManager {
    /// Create a new cast manager
    pub fn new(streaming_port: u16) -> Result<Self> {
        let local_ip = local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|_| "127.0.0.1".to_string());

        info!(
            local_ip = %local_ip,
            streaming_port = streaming_port,
            "Initializing cast manager"
        );

        Ok(Self {
            devices: Arc::new(RwLock::new(HashMap::new())),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            local_ip,
            streaming_port,
        })
    }

    /// Discover available cast devices on the network
    pub async fn discover_devices(&self, timeout: Duration) -> Result<Vec<CastDevice>> {
        info!("Starting device discovery (timeout: {:?})", timeout);

        let mut discovered_devices = Vec::new();

        // Discover Chromecast devices via mDNS
        let chromecast_devices = self.discover_chromecast_devices(timeout).await?;
        discovered_devices.extend(chromecast_devices);

        // Discover DLNA/UPnP devices via SSDP
        let dlna_devices = self.discover_dlna_devices(timeout).await?;
        discovered_devices.extend(dlna_devices);

        // Update internal device list
        let mut devices = self.devices.write().await;
        for device in &discovered_devices {
            devices.insert(device.id.clone(), device.clone());
        }

        info!(
            "Device discovery complete: found {} devices",
            discovered_devices.len()
        );

        Ok(discovered_devices)
    }

    /// Discover Chromecast devices using mDNS/DNS-SD
    async fn discover_chromecast_devices(&self, timeout: Duration) -> Result<Vec<CastDevice>> {
        debug!("Discovering Chromecast devices via mDNS");

        let mdns = mdns_sd::ServiceDaemon::new()
            .map_err(|e| anyhow!("Failed to create mDNS daemon: {}", e))?;

        let service_type = "_googlecast._tcp.local.";
        let receiver = mdns
            .browse(service_type)
            .map_err(|e| anyhow!("Failed to browse mDNS services: {}", e))?;

        let mut devices = Vec::new();
        let deadline = tokio::time::Instant::now() + timeout;

        while tokio::time::Instant::now() < deadline {
            if let Ok(event) = tokio::time::timeout(Duration::from_millis(500), receiver.recv_async()).await {
                match event {
                    Ok(mdns_sd::ServiceEvent::ServiceResolved(info)) => {
                        debug!("Found Chromecast device: {}", info.get_fullname());

                        if let Some(address) = info.get_addresses().iter().next() {
                            let ip = match address {
                                IpAddr::V4(ipv4) => ipv4.to_string(),
                                IpAddr::V6(ipv6) => ipv6.to_string(),
                            };

                            let device = CastDevice {
                                id: format!("chromecast-{}", ip.replace('.', "-")),
                                name: info.get_hostname().trim_end_matches('.').to_string(),
                                protocol: CastProtocol::Chromecast,
                                ip_address: ip,
                                port: info.get_port(),
                                model: info.get_property("md").map(|v| v.val_str().to_string()),
                                manufacturer: Some("Google".to_string()),
                                status: DeviceStatus::Available,
                            };

                            devices.push(device);
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        warn!("mDNS receiver error: {}", e);
                        break;
                    }
                }
            }
        }

        mdns.shutdown().ok();
        info!("Found {} Chromecast devices", devices.len());
        Ok(devices)
    }

    /// Discover DLNA/UPnP devices using SSDP
    async fn discover_dlna_devices(&self, timeout: Duration) -> Result<Vec<CastDevice>> {
        debug!("Discovering DLNA/UPnP devices via SSDP");

        let search_target = ssdp_client::SearchTarget::RootDevice;
        let responses = tokio::task::spawn_blocking(move || -> Result<Vec<_>> {
            use futures::{executor, StreamExt};
            
            // Execute SSDP search and collect results
            let search_future = ssdp_client::search(&search_target, timeout, 2);
            let stream = executor::block_on(search_future)
                .map_err(|e| anyhow!("SSDP search failed: {}", e))?;
            
            let results = executor::block_on(stream.collect::<Vec<_>>());
            
            // Filter out errors and collect successful responses
            Ok(results.into_iter().filter_map(|r| r.ok()).collect())
        })
        .await
        .map_err(|e| anyhow!("SSDP search task failed: {}", e))??;

        let mut devices = Vec::new();

        for response in responses {
            debug!("Found SSDP device: {}", response.location());

            // Fetch device description XML
            if let Ok(device_info) = self.fetch_dlna_device_info(response.location()).await {
                devices.push(device_info);
            }
        }

        info!("Found {} DLNA/UPnP devices", devices.len());
        Ok(devices)
    }

    /// Fetch DLNA device information from description URL
    async fn fetch_dlna_device_info(&self, location: &str) -> Result<CastDevice> {
        let response = reqwest::get(location)
            .await
            .map_err(|e| anyhow!("Failed to fetch device description: {}", e))?;

        let xml = response
            .text()
            .await
            .map_err(|e| anyhow!("Failed to read device description: {}", e))?;

        // Parse XML to extract device info
        self.parse_dlna_description(&xml, location)
    }

    /// Parse DLNA device description XML
    fn parse_dlna_description(&self, xml: &str, location: &str) -> Result<CastDevice> {
        use quick_xml::events::Event;
        use quick_xml::Reader;

        let mut reader = Reader::from_str(xml);
        reader.config_mut().trim_text(true);

        let mut friendly_name = String::new();
        let mut model_name = None;
        let mut manufacturer = None;
        let mut current_tag = String::new();

        let mut buf = Vec::new();
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    current_tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                }
                Ok(Event::Text(e)) => {
                    let text = e.unescape().unwrap_or_default().to_string();
                    match current_tag.as_str() {
                        "friendlyName" => friendly_name = text,
                        "modelName" => model_name = Some(text),
                        "manufacturer" => manufacturer = Some(text),
                        _ => {}
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(anyhow!("XML parsing error: {}", e)),
                _ => {}
            }
            buf.clear();
        }

        // Extract IP and port from location URL
        let url = url::Url::parse(location)
            .map_err(|e| anyhow!("Invalid device location URL: {}", e))?;
        let ip = url
            .host_str()
            .ok_or_else(|| anyhow!("No host in location URL"))?
            .to_string();
        let port = url.port().unwrap_or(80);

        Ok(CastDevice {
            id: format!("dlna-{}", ip.replace('.', "-")),
            name: if friendly_name.is_empty() {
                ip.clone()
            } else {
                friendly_name
            },
            protocol: CastProtocol::DLNA,
            ip_address: ip,
            port,
            model: model_name,
            manufacturer,
            status: DeviceStatus::Available,
        })
    }

    /// Get list of discovered devices
    pub async fn get_devices(&self) -> Vec<CastDevice> {
        self.devices.read().await.values().cloned().collect()
    }

    /// Start casting to a device
    pub async fn start_cast(
        &self,
        device_id: &str,
        media_url: &str,
        title: Option<String>,
        subtitle_url: Option<String>,
    ) -> Result<CastSession> {
        let devices = self.devices.read().await;
        let device = devices
            .get(device_id)
            .ok_or_else(|| anyhow!("Device not found: {}", device_id))?;

        info!(
            device_id = %device_id,
            device_name = %device.name,
            protocol = ?device.protocol,
            "Starting cast session"
        );

        let session_id = uuid::Uuid::new_v4().to_string();

        // Convert local URLs to accessible network URLs
        let accessible_media_url = self.make_url_accessible(media_url);
        let accessible_subtitle_url = subtitle_url.as_ref().map(|url| self.make_url_accessible(url));

        let session = match device.protocol {
            CastProtocol::Chromecast => {
                self.start_chromecast_session(
                    device,
                    &session_id,
                    &accessible_media_url,
                    title.as_deref(),
                    accessible_subtitle_url.as_deref(),
                )
                .await?
            }
            CastProtocol::DLNA => {
                self.start_dlna_session(
                    device,
                    &session_id,
                    &accessible_media_url,
                    title.as_deref(),
                    accessible_subtitle_url.as_deref(),
                )
                .await?
            }
            CastProtocol::AirPlay => {
                return Err(anyhow!("AirPlay not yet implemented"));
            }
        };

        // Store session
        self.sessions.write().await.insert(session_id.clone(), session.clone());

        info!(session_id = %session_id, "Cast session started successfully");
        Ok(session)
    }

    /// Convert localhost URLs to network-accessible URLs
    fn make_url_accessible(&self, url: &str) -> String {
        if url.starts_with("http://127.0.0.1") || url.starts_with("http://localhost") {
            url.replace("127.0.0.1", &self.local_ip)
                .replace("localhost", &self.local_ip)
        } else {
            url.to_string()
        }
    }

    /// Start Chromecast session
    async fn start_chromecast_session(
        &self,
        device: &CastDevice,
        session_id: &str,
        media_url: &str,
        title: Option<&str>,
        subtitle_url: Option<&str>,
    ) -> Result<CastSession> {
        debug!("Starting Chromecast session");

        let device_ip = device.ip_address.clone();
        let device_port = device.port;
        let device_id = device.id.clone();
        let session_id = session_id.to_string();
        let media_url = media_url.to_string();
        let title = title.map(String::from);
        let subtitle_url = subtitle_url.map(String::from);

        // Perform entire Cast protocol flow in a single blocking task
        tokio::task::spawn_blocking(move || {
            use rust_cast::channels::media::{Media, StreamType};
            use std::time::Duration as StdDuration;

            // Connect to Chromecast device
            info!(ip = %device_ip, port = device_port, "Connecting to Chromecast");
            
            let cast_device = rust_cast::CastDevice::connect_without_host_verification(
                &device_ip,
                device_port,
            )
            .map_err(|e| anyhow!("Failed to connect to Chromecast: {}", e))?;

            info!("Cast device connected, launching Default Media Receiver app");

            // Launch the Default Media Receiver app (required for playing media)
            let app = cast_device
                .receiver
                .launch_app(&rust_cast::channels::receiver::CastDeviceApp::DefaultMediaReceiver)
                .map_err(|e| anyhow!("Failed to launch media receiver app: {}", e))?;

            info!("Media receiver app launched: {}", app.display_name);

            // Wait for app to initialize
            std::thread::sleep(StdDuration::from_millis(2000));

            // Connect to transport (required before loading media)
            cast_device
                .connection
                .connect(&app.transport_id)
                .map_err(|e| anyhow!("Failed to connect to transport: {}", e))?;

            info!("Connected to transport, loading media");

            // Build media metadata
            let media = Media {
                content_id: media_url.clone(),
                content_type: "video/mp4".to_string(),
                stream_type: StreamType::Live,
                duration: None,
                metadata: None,
            };

            // Load media on Chromecast using the media channel
            let media_status = cast_device
                .media
                .load(
                    &app.transport_id,
                    &app.session_id,
                    &media,
                )
                .map_err(|e| anyhow!("Failed to load media: {}", e))?;

            info!("Media loaded successfully on Chromecast");

            // Extract duration and position from media status if available
            let duration = media_status
                .entries
                .first()
                .and_then(|e| e.media.as_ref())
                .and_then(|m| m.duration)
                .unwrap_or(0.0) as f64;

            let position = media_status
                .entries
                .first()
                .and_then(|e| e.current_time)
                .unwrap_or(0.0) as f64;

            Ok(CastSession {
                session_id,
                device_id,
                media_url,
                title,
                subtitle_url,
                position,
                duration,
                state: PlaybackState::Playing,
            })
        })
        .await
        .map_err(|e| anyhow!("Failed to execute Cast protocol: {}", e))?
    }

    /// Start DLNA session
    async fn start_dlna_session(
        &self,
        device: &CastDevice,
        session_id: &str,
        media_url: &str,
        title: Option<&str>,
        _subtitle_url: Option<&str>,
    ) -> Result<CastSession> {
        debug!("Starting DLNA session");

        // Build SOAP request for SetAVTransportURI
        let soap_body = format!(
            r#"<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <CurrentURI>{}</CurrentURI>
      <CurrentURIMetaData>{}</CurrentURIMetaData>
    </u:SetAVTransportURI>
  </s:Body>
</s:Envelope>"#,
            media_url,
            Self::build_didl_metadata(media_url, title.unwrap_or("StreamGo Media"))
        );

        // Send SOAP request to device
        let control_url = format!("http://{}:{}/AVTransport/control", device.ip_address, device.port);
        let client = reqwest::Client::new();
        let response = client
            .post(&control_url)
            .header("Content-Type", "text/xml; charset=utf-8")
            .header("SOAPAction", "\"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI\"")
            .body(soap_body)
            .send()
            .await;

        match response {
            Ok(resp) if resp.status().is_success() => {
                // Start playback
                let play_body = r#"<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <Speed>1</Speed>
    </u:Play>
  </s:Body>
</s:Envelope>"#;

                let _play_response = client
                    .post(&control_url)
                    .header("Content-Type", "text/xml; charset=utf-8")
                    .header("SOAPAction", "\"urn:schemas-upnp-org:service:AVTransport:1#Play\"")
                    .body(play_body)
                    .send()
                    .await
                    .map_err(|e| anyhow!("Failed to start DLNA playback: {}", e))?;

                info!("DLNA session started successfully");

                Ok(CastSession {
                    session_id: session_id.to_string(),
                    device_id: device.id.clone(),
                    media_url: media_url.to_string(),
                    title: title.map(String::from),
                    subtitle_url: None, // DLNA subtitle support varies
                    position: 0.0,
                    duration: 0.0,
                    state: PlaybackState::Playing,
                })
            }
            Ok(resp) => {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                error!(
                    status = %status,
                    body = %body,
                    "DLNA SetAVTransportURI failed"
                );
                Err(anyhow!("DLNA command failed: {}", status))
            }
            Err(e) => Err(anyhow!("Failed to send DLNA command: {}", e)),
        }
    }

    /// Build DIDL-Lite metadata XML for DLNA
    fn build_didl_metadata(url: &str, title: &str) -> String {
        format!(
            r#"&lt;DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"&gt;&lt;item id="0" parentID="-1" restricted="1"&gt;&lt;dc:title&gt;{}&lt;/dc:title&gt;&lt;res protocolInfo="http-get:*:video/*:*"&gt;{}&lt;/res&gt;&lt;upnp:class&gt;object.item.videoItem&lt;/upnp:class&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;"#,
            title, url
        )
    }

    /// Stop casting session
    pub async fn stop_cast(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.write().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| anyhow!("Session not found: {}", session_id))?
            .clone();

        info!(session_id = %session_id, "Stopping cast session");

        let devices = self.devices.read().await;
        if let Some(device) = devices.get(&session.device_id) {
            match device.protocol {
                CastProtocol::DLNA => {
                    // Send DLNA Stop command
                    self.send_dlna_stop(device).await?;
                }
                CastProtocol::Chromecast => {
                    // Send Chromecast STOP command
                    self.send_chromecast_stop(device).await?;
                }
                _ => {}
            }
        }

        sessions.remove(session_id);
        info!("Cast session stopped");
        Ok(())
    }

    /// Send DLNA stop command
    async fn send_dlna_stop(&self, device: &CastDevice) -> Result<()> {
        let stop_body = r#"<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:Stop>
  </s:Body>
</s:Envelope>"#;

        let control_url = format!("http://{}:{}/AVTransport/control", device.ip_address, device.port);
        let client = reqwest::Client::new();
        client
            .post(&control_url)
            .header("Content-Type", "text/xml; charset=utf-8")
            .header("SOAPAction", "\"urn:schemas-upnp-org:service:AVTransport:1#Stop\"")
            .body(stop_body)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to send DLNA stop: {}", e))?;

        Ok(())
    }

    /// Send Chromecast stop command
    async fn send_chromecast_stop(&self, device: &CastDevice) -> Result<()> {
        let device_ip = device.ip_address.clone();
        let device_port = device.port;

        tokio::task::spawn_blocking(move || {
            info!(ip = %device_ip, port = device_port, "Stopping Chromecast playback");

            // Connect to Chromecast
            let cast_device = rust_cast::CastDevice::connect_without_host_verification(
                &device_ip,
                device_port,
            )
            .map_err(|e| anyhow!("Failed to connect to Chromecast for stop: {}", e))?;

            // Get current receiver status to find active app
            let status = cast_device
                .receiver
                .get_status()
                .map_err(|e| anyhow!("Failed to get receiver status: {}", e))?;

            // Stop media on each active app
            for app in status.applications {
                info!("Stopping app: {} ({})", app.display_name, app.app_id);

                // Connect to transport
                if let Err(e) = cast_device.connection.connect(&app.transport_id) {
                    warn!("Failed to connect to transport for stop: {}", e);
                    continue;
                }

                // Get media status to find media session ID
                match cast_device.media.get_status(&app.transport_id, None) {
                    Ok(media_status) => {
                        // Stop each media session
                        for entry in media_status.entries {
                            info!("Stopping media session: {}", entry.media_session_id);
                            if let Err(e) = cast_device.media.stop(&app.transport_id, entry.media_session_id) {
                                warn!("Failed to stop media session {}: {}", entry.media_session_id, e);
                            }
                        }
                    }
                    Err(e) => {
                        warn!("Failed to get media status: {}", e);
                    }
                }

                // Disconnect from app
                let _ = cast_device.connection.disconnect(&app.transport_id);
            }

            info!("Chromecast playback stopped");
            Ok(())
        })
        .await
        .map_err(|e| anyhow!("Failed to execute Chromecast stop: {}", e))?
    }

    /// Get active cast sessions
    pub async fn get_sessions(&self) -> Vec<CastSession> {
        self.sessions.read().await.values().cloned().collect()
    }

    /// Get specific session status
    pub async fn get_session_status(&self, session_id: &str) -> Option<CastSession> {
        self.sessions.read().await.get(session_id).cloned()
    }
}
