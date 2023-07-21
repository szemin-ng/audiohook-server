# audiohook-server
A NodeJS server to receive AudioHook Monitoring data from Genesys Cloud and write it to a WAV file.

## AudioHook Audio
AudioHook's PCM audio data is in mu-law, 8 bit, mono and 8000kz format.

## WAV File Format
WAV file is created according to these specs: http://soundfile.sapp.org/doc/WaveFormat/.
The audio format written into WAV file header to indicate mu-law is 7.

## Server Configuration
1. Key in Genesys Cloud org id in environment.ts.
2. Key in AudioHook integration API key in environment.ts.

## AudioHook Configuration in Genesys Cloud
1. Install AudioHook integration
2. Point it to this NodeJS server. You can use localtunnel (https://www.npmjs.com/package/localtunnel) as a tunnel.
3. Key in API key.
4. Configure transcription to activate either through queue or flow.