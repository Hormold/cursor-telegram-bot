import { logger } from './logger';
import type { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { google } from '@ai-sdk/google';
import { generateText, type CoreMessage } from 'ai';
import { z } from 'zod';
import { AgentImage } from './types/cursor-official';
import sharp from 'sharp';

const transcriptionSystemPrompt = `You are a highly proficient audio transcription robot. Your primary function is to accurately convert spoken audio from telegram voice messages into written text with correct punctuation, formatting and language preservation.

## Key Instructions
0.  Do not add anything not related to the transcription / tldr to output, keep it as correct as possible.
1.  **Language Preservation**: Transcribe the audio in the exact language spoken. Do not translate.
2.  **Accuracy**: Capture all spoken words precisely.
3.  **Punctuation and Formatting**: Apply standard punctuation (periods, commas, question marks, capitalization, paragraphs for distinct speakers or long pauses if discernible) to ensure the text is clear, well-structured, and easy to read.
4.  **No Extraneous Content**: Your output must *only* be the transcribed text. Do not include any introductory phrases (e.g., "Here is the transcription:"), summaries, disclaimers, or any other text that is not part of the direct transcription.
5.  **Tool Usage**: You MUST use the 'outputTranscription' tool to provide the final transcribed text.
6.  **Filler Words**: Remove all filler words like "um", "uh", "ah", "er", "like" and same on another languages. If the text is really short, just return the text as is.
7.  **Points**: If voice message contains some lists, points, etc. Make proper formatting for them.
  Example:
  "do this, do that, do the other thing"
  should be formatted as:
  "1. Do this
  2. Do that
  3. Do the other thing"
8.  **Numbers**: If voice message contains numbers, make proper formatting for them.
  Example:
  "seven thousand, eight hundred, nine" -> "7000, 800, 9"
9.  **Trailing Characters**: Ensure that no extraneous characters, such as underscores (_) or other non-spoken symbols, are appended to the end of the transcription. The output should end cleanly with the last spoken word or standard punctuation.

## TLDR
If text is longer than 300 characters, provide a tldr summary of the transcription. The summary MUST:
1. Use the same language as the transcription
2. Maintain the same first/third person perspective as the original message
3. Keep the same tone, style and speaking voice
4. Be 20-30 words summarizing the general idea 
5. Be a single sentence, not a list of points
6. NOT describe the message in third person (like "the user talks about...") - instead, preserve the original voice`;

export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string = 'audio/ogg', // Default to ogg if not provided, but expect it for documents
): Promise<{ transcribedText: string; tldr: string | null }> {
  logger.info(`Starting audio transcription with Gemini for mimeType: ${mimeType}...`);

  return new Promise<{ transcribedText: string; tldr: string | null }>(
    async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Transcription timed out after 60 seconds')); // This 60000 should be configurable
      }, 60000);

      try {
        const userMessageContent: CoreMessage = {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe the audio and provide the result using the outputTranscription tool.',
            },
            {
              type: 'file',
              mimeType: mimeType, // Use the passed mimeType
              data: audioBuffer,
            },
          ],
        };

        await generateText({
          model: google('gemini-2.5-pro-preview-05-06'),
          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingBudget: 1024,
                includeThoughts: false,
              },
              responseModalities: ['TEXT'],
            } satisfies GoogleGenerativeAIProviderOptions,
          },
          system: transcriptionSystemPrompt,
          messages: [userMessageContent],
          toolChoice: { type: 'tool', toolName: 'outputTranscription' },
          tools: {
            outputTranscription: {
              description:
                "Outputs the final transcribed text from the audio, ensuring it's well-formatted and in the original language.",
              parameters: z.object({
                transcribedText: z
                  .string()
                  .describe(
                    'The complete and accurately transcribed text from the audio, in the original language, with proper punctuation.',
                  ),
                tldr: z
                  .string()
                  .nullable()
                  .describe(
                    'A short summary of the transcription, in the original language, with proper punctuation (Optional).',
                  ),
              }),
              execute: async ({
                transcribedText,
                tldr,
              }: {
                transcribedText: string;
                tldr: string | null;
              }) => {
                logger.info('Transcription tool executed by AI.');
                clearTimeout(timeoutId);
                resolve({ transcribedText, tldr });
                return 'Transcription successfully processed and extracted.';
              },
            },
          },
        });
      } catch (error) {
        logger.info(`Error during transcription: ${(error as Error).message}`);
        clearTimeout(timeoutId);
        reject(error);
      }
    },
  );
}

export async function convertTelegramImageToCursorFormat(
  fileBuffer: Buffer,
  telegramFileId: string
): Promise<AgentImage> {
  logger.info(`📸 Converting ${fileBuffer.length} bytes image to PNG format`);
  
  // Convert image to PNG and get dimensions
  const pngBuffer = await sharp(fileBuffer)
    .png()
    .toBuffer();
  
  const metadata = await sharp(pngBuffer).metadata();
  logger.info(`📸 PNG conversion complete: ${metadata.width}x${metadata.height}, ${pngBuffer.length} bytes`);
  
  return {
    data: pngBuffer.toString('base64'),
    dimension: {
      width: metadata.width || 0,
      height: metadata.height || 0,
    },
  };
}
