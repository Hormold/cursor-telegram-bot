import { ConversationImage } from './types/cursor-api';
import * as fs from 'fs';
import * as path from 'path';

const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

// Get cache directory based on DB_PATH
function getCacheDir(): string {
  const dbPath = process.env.DB_PATH || 'bot.db';
  const dbDir = path.dirname(dbPath);
  const cacheDir = path.join(dbDir, 'image-cache');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  return cacheDir;
}

// Cache cleanup function
function cleanupImageCache() {
  const cacheDir = getCacheDir();
  const now = Date.now();
  
  try {
    const files = fs.readdirSync(cacheDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(cacheDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > CACHE_TTL) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up expired cache file: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up image cache:', error);
  }
}

// Cleanup cache every minute
setInterval(cleanupImageCache, 60000);

// Cache helper functions
function getCacheKey(userId: number, chatId: number): string {
  return `${userId}_${chatId}`;
}

export function saveImagesToCache(userId: number, chatId: number, images: ConversationImage[]) {
  const cacheDir = getCacheDir();
  const key = getCacheKey(userId, chatId);
  const filePath = path.join(cacheDir, `${key}.json`);
  
  try {
    const cacheData = {
      images,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2));
    console.log(`Saved ${images.length} images to cache for user ${userId} in chat ${chatId}`);
  } catch (error) {
    console.error('Error saving images to cache:', error);
  }
}

export function getImagesFromCache(userId: number, chatId: number): ConversationImage[] {
  const cacheDir = getCacheDir();
  const key = getCacheKey(userId, chatId);
  const filePath = path.join(cacheDir, `${key}.json`);
  
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const stats = fs.statSync(filePath);
    const now = Date.now();
    
    // Check if expired
    if (now - stats.mtime.getTime() > CACHE_TTL) {
      fs.unlinkSync(filePath);
      return [];
    }
    
    const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return cacheData.images || [];
  } catch (error) {
    console.error('Error reading images from cache:', error);
    return [];
  }
}

export function clearImagesFromCache(userId: number, chatId: number) {
  const cacheDir = getCacheDir();
  const key = getCacheKey(userId, chatId);
  const filePath = path.join(cacheDir, `${key}.json`);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Cleared image cache for user ${userId} in chat ${chatId}`);
    }
  } catch (error) {
    console.error('Error clearing images from cache:', error);
  }
} 