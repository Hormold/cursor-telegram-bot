import { logger } from './logger';
import { AgentImage } from './types/cursor-official';
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
          logger.info(`Cleaned up expired cache file: ${file}`);
        }
      }
    }
  } catch (error) {
    logger.error('Error cleaning up image cache:', error);
  }
}

// Cleanup cache every minute
let cleanupInterval: NodeJS.Timeout | null = null;
if (process.env.NODE_ENV !== 'test') {
  cleanupInterval = setInterval(cleanupImageCache, 60000);
}

// Export cleanup function for tests
export function stopCleanupInterval() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Cache helper functions
function getCacheKey(userId: number, chatId: number): string {
  return `${userId}_${chatId}`;
}

export function saveImagesToCache(userId: number, chatId: number, images: AgentImage[]) {
  const cacheDir = getCacheDir();
  const key = getCacheKey(userId, chatId);
  const filePath = path.join(cacheDir, `${key}.json`);
  
  try {
    const cacheData = {
      images,
      timestamp: Date.now()
    };
    
    const jsonSize = JSON.stringify(cacheData).length;
    logger.info(`📸 Saving ${images.length} images to cache file ${filePath} (${Math.round(jsonSize / 1024)}KB)`);
    
    fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2));
    logger.info(`📸 Successfully saved ${images.length} images to cache for user ${userId} in chat ${chatId}`);
  } catch (error) {
    logger.error('Error saving images to cache:', error);
  }
}

export function getImagesFromCache(userId: number, chatId: number): AgentImage[] {
  const cacheDir = getCacheDir();
  const key = getCacheKey(userId, chatId);
  const filePath = path.join(cacheDir, `${key}.json`);
  
  try {
    if (!fs.existsSync(filePath)) {
      logger.info(`📸 No cache file found for user ${userId} in chat ${chatId}`);
      return [];
    }
    
    const stats = fs.statSync(filePath);
    const now = Date.now();
    const age = now - stats.mtime.getTime();
    
    logger.info(`📸 Cache file age: ${Math.round(age / 1000)}s (TTL: ${CACHE_TTL / 1000}s)`);
    
    // Check if expired
    if (age > CACHE_TTL) {
      logger.info(`📸 Cache expired, removing file`);
      fs.unlinkSync(filePath);
      return [];
    }
    
    const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const images = cacheData.images || [] as AgentImage[];
    logger.info(`📸 Successfully loaded ${images.length} images from cache`);
    
    return images;
  } catch (error) {
    logger.error('Error reading images from cache:', error);
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
      logger.info(`📸 Clearing cache file ${filePath} (${fileSize}KB)`);
      
      fs.unlinkSync(filePath);
      logger.info(`📸 Successfully cleared image cache for user ${userId} in chat ${chatId}`);
    } else {
      logger.info(`📸 No cache file to clear for user ${userId} in chat ${chatId}`);
    }
  } catch (error) {
    logger.error('Error clearing images from cache:', error);
  }
} 
