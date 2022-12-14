import * as fs from "fs";
import logger from "./log";

/**
 * Writes raw PCMU (mu-law) data to a WAV file.
 * @param rawPcm Buffer containing raw PCMU data.
 * @param bit Bits per sample (8 or 16)
 * @param numChannels Number of channels (1 = mono, 2 = stereo)
 * @param numSamples Sample rate (8000, 16000, 32000) 
 * @param wavFile File path and name of WAV file to create.
 */
export function PcmuToWav(rawPcm: Buffer, bit: number, numChannels: number, numSamples: number, wavFile: string) {

  // WAV file header: http://soundfile.sapp.org/doc/WaveFormat/ 
  let riffHeader = Buffer.from([0x52, 0x49, 0x46, 0x46]);       // "RIFF" string
  let fileSize = Buffer.from([0x00, 0x00, 0x00, 0x00]);         // total file size
  let waveHeader = Buffer.from([0x57, 0x41, 0x56, 0x45]);       // "WAVE" string
  let fmtChunkHeader = Buffer.from([0x66, 0x6d, 0x74, 0x20]);   // "fmt " string (with the trailing space)
  let fmtChunkSize = Buffer.from([0x10, 0x00, 0x00, 0x00]);     // size of fmt chunk
  let pcmFormat = Buffer.from([0x07, 0x00]);                    // audio format: 7 = mu-law audio format
  let channels = Buffer.from([0x00, 0x00]);                     // channels: 1 = mono, 2 = stereo
  let sampleRate = Buffer.from([0x00, 0x00, 0x00, 0x00]);       // sample rate, e.g., 8000, 16000
  let byteRate = Buffer.from([0x00, 0x00, 0x00, 0x00]);         // byte rate: (SampleRate * NumChannels * BitsPerSample / 8)
  let blockAlign = Buffer.from([0x00, 0x00]);                   // block align: (NumChannels * BitsPerSample / 8)
  let bitsPerSample = Buffer.from([0x00, 0x00]);                // bits per sample, e.g., 8 bit, 16 bit
  let dataChunkHeader = Buffer.from([0x64, 0x61, 0x74, 0x61]);  // "data" string
  let dataChunkSize = Buffer.from([0x00, 0x00, 0x00, 0x00]);    // size of data chunk: NumSamples * NumChannels * BitsPerSample / 8

  // fill up audio format (fmt) information
  channels.writeUInt16LE(numChannels);
  sampleRate.writeUInt32LE(numSamples);
  byteRate.writeUInt32LE(numSamples * numChannels * bit / 8);
  blockAlign.writeUInt16LE(numChannels * bit / 8);
  bitsPerSample.writeUInt16LE(bit);

  // fill up fmt chunk size
  let fmtChunk = Buffer.concat([pcmFormat, channels, sampleRate, byteRate, blockAlign, bitsPerSample]);
  fmtChunkSize.writeUInt32LE(fmtChunk.length);

  // fill up data chunk and file size
  dataChunkSize.writeUInt32LE(rawPcm.length);
  fileSize.writeUInt32LE(riffHeader.length + fileSize.length + waveHeader.length + fmtChunkHeader.length + fmtChunkSize.length + fmtChunk.length + dataChunkHeader.length + dataChunkSize.length + rawPcm.length);

  // this is the Buffer containing the entire WAV file
  var buf = Buffer.concat([riffHeader, fileSize, waveHeader, fmtChunkHeader, fmtChunkSize, fmtChunk, dataChunkHeader, dataChunkSize, rawPcm]);

  fs.writeFile(wavFile, buf, (err) => {
    if (err) logger.error(err, "Failed to save PCM to WAV file.");
  });
}
