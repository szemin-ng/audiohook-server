# audiohook-server
A NodeJS server to receive AudioHook Monitoring data from Genesys Cloud and write it to a WAV file.

## Current Limitations of AudioHook in Genesys Cloud
Genesys Cloud streams audio if:
1. Transcription is enabled for the queue. In this case, all calls entering the queue regardless of language is sent to AudioHook server.
2. Transcription action is executed in an Architect call flow. In this case, Architect flow can make decisions when to activate transcription and thus send call to AudioHook server.

Since Transcription must be configured before AudioHook will start streaming, WEM Add-on license is needed (for transcription).

It is not possible to connect Genesys Cloud to multiple AudioHook servers, e.g., one server for 3rd party transcription and another for biometrics.

## AudioHook Audio
AudioHook's PCM audio data is in mu-law, 8 bit, mono and 8000kz format.

## WAV File Format
WAV file is created according to these specs: http://soundfile.sapp.org/doc/WaveFormat/.
The audio format written into WAV file header to indicate mu-law is 7.

## Server Configuration
1. Key in ORG_ID in index.ts.
2. Key in API key in index.ts.

## AudioHook Configuration in Genesys Cloud
1. Install AudioHook integration
2. Point it to this NodeJS server. You can use ngrok to tunnel through.
3. Key in API key.
4. Configure transcription to activate either through queue or flow.

## Not Supported
Don't support "discard" message yet.