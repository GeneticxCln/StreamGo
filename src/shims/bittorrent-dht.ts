// Browser stub for bittorrent-dht used by webtorrent's discovery layer
// In browsers, DHT is unavailable; WebTorrent ignores it when not present.
// Export a minimal Client to satisfy module shape during bundling.
export class Client {
  constructor(..._args: any[]) {}
  listen(..._args: any[]): void {}
  destroy(..._args: any[]): void {}
}
export default { Client };