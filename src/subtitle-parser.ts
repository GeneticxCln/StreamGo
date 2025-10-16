/**
 * Subtitle Parser
 * Parses SRT and VTT subtitle files
 */

export interface SubtitleCue {
  start: number; // seconds
  end: number; // seconds
  text: string;
}

/**
 * Parse SRT subtitle format
 */
export function parseSRT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = content.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;
    
    // Line 1: index (skip)
    // Line 2: timestamp
    const timeLine = lines[1];
    if (!timeLine.includes('-->')) continue;
    
    const [startStr, endStr] = timeLine.split('-->');
    const start = parseTimestamp(startStr.trim());
    const end = parseTimestamp(endStr.trim());
    
    // Lines 3+: text
    const text = lines.slice(2).join('\n').trim();
    
    if (text) {
      cues.push({ start, end, text });
    }
  }
  
  return cues;
}

/**
 * Parse VTT subtitle format
 */
export function parseVTT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = content.split('\n');
  let i = 0;
  
  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->');
      const start = parseTimestamp(startStr.trim());
      const end = parseTimestamp(endStr.trim().split(/[\s\[]/)[0]);
      
      // Get text (next lines until empty)
      const textLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }
      
      if (textLines.length > 0) {
        cues.push({
          start,
          end,
          text: textLines.join('\n'),
        });
      }
    }
    
    i++;
  }
  
  return cues;
}

/**
 * Parse timestamp (supports various formats)
 * Examples: 00:00:10.500, 00:00:10,500, 00:10.500
 */
function parseTimestamp(timestamp: string): number {
  // Replace comma with dot
  timestamp = timestamp.replace(',', '.');
  
  const parts = timestamp.split(':');
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  
  if (parts.length === 3) {
    // HH:MM:SS.mmm
    hours = parseInt(parts[0]);
    minutes = parseInt(parts[1]);
    seconds = parseFloat(parts[2]);
  } else if (parts.length === 2) {
    // MM:SS.mmm
    minutes = parseInt(parts[0]);
    seconds = parseFloat(parts[1]);
  } else if (parts.length === 1) {
    // SS.mmm
    seconds = parseFloat(parts[0]);
  }
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Convert SRT to VTT format
 */
export function convertSRTtoVTT(srtContent: string): string {
  const cues = parseSRT(srtContent);
  return convertCuesToVTT(cues);
}

/**
 * Convert cues array to VTT format
 */
export function convertCuesToVTT(cues: SubtitleCue[]): string {
  let vtt = 'WEBVTT\n\n';
  
  cues.forEach((cue, index) => {
    const start = formatTimestamp(cue.start);
    const end = formatTimestamp(cue.end);
    vtt += `${index + 1}\n${start} --> ${end}\n${cue.text}\n\n`;
  });
  
  return vtt;
}

/**
 * Format seconds to VTT timestamp format
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const h = hours.toString().padStart(2, '0');
  const m = minutes.toString().padStart(2, '0');
  const s = secs.toFixed(3).padStart(6, '0');
  
  return `${h}:${m}:${s}`;
}

/**
 * Detect subtitle format from content
 */
export function detectSubtitleFormat(content: string): 'srt' | 'vtt' | 'unknown' {
  if (content.includes('WEBVTT')) {
    return 'vtt';
  } else if (/^\d+\s*\n\d{2}:\d{2}:\d{2}/.test(content.trim())) {
    return 'srt';
  }
  return 'unknown';
}

/**
 * Adjust timestamps in VTT content by offset (in seconds)
 */
export function adjustTimestamps(vttContent: string, offsetSeconds: number): string {
  const cues = parseVTT(vttContent);
  const adjustedCues = cues.map(cue => ({
    start: Math.max(0, cue.start + offsetSeconds),
    end: Math.max(0, cue.end + offsetSeconds),
    text: cue.text,
  }));
  return convertCuesToVTT(adjustedCues);
}
