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
    
    const jsonSize = JSON.stringify(cacheData).length;
    console.log(`📸 Saving ${images.length} images to cache file ${filePath} (${Math.round(jsonSize / 1024)}KB)`);
    
    fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2));
    console.log(`📸 Successfully saved ${images.length} images to cache for user ${userId} in chat ${chatId}`);
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
      console.log(`📸 No cache file found for user ${userId} in chat ${chatId}`);
      return [];
    }
    
    const stats = fs.statSync(filePath);
    const now = Date.now();
    const age = now - stats.mtime.getTime();
    
    console.log(`📸 Cache file age: ${Math.round(age / 1000)}s (TTL: ${CACHE_TTL / 1000}s)`);
    
    // Check if expired
    if (age > CACHE_TTL) {
      console.log(`📸 Cache expired, removing file`);
      fs.unlinkSync(filePath);
      return [];
    }
    
    const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const images = cacheData.images || [];
    console.log(`📸 Successfully loaded ${images.length} images from cache`);
    
    return images;
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
      const stats = fs.statSync(filePath);
      const fileSize = Math.round(stats.size / 1024);
      console.log(`📸 Clearing cache file ${filePath} (${fileSize}KB)`);
      
      fs.unlinkSync(filePath);
      console.log(`📸 Successfully cleared image cache for user ${userId} in chat ${chatId}`);
    } else {
      console.log(`📸 No cache file to clear for user ${userId} in chat ${chatId}`);
    }
  } catch (error) {
    console.error('Error clearing images from cache:', error);
  }
} 