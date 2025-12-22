import fs from 'fs/promises';
import path from 'path';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';
import fetch from 'node-fetch';
import chalk from 'chalk';

const GITHUB_REPO = 'gamelist1990/BunProxy';
const RELEASE_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}/releases`;

export interface ReleaseAsset {
  name: string;
  url: string;
  downloadUrl: string;
  size: number;
  sha256?: string;
}

export interface Release {
  version: string;
  tag: string;
  publishedAt: string;
  assets: ReleaseAsset[];
}

export async function getLatestRelease(): Promise<Release> {
  console.log(chalk.blue('Fetching latest release from GitHub...'));
  const response = await fetch(`${RELEASE_API_BASE}/latest`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch latest release: ${response.statusText}`);
  }

  const data: any = await response.json();
  
  return {
    version: data.tag_name.replace('release-', ''),
    tag: data.tag_name,
    publishedAt: data.published_at,
    assets: data.assets.map((asset: any) => ({
      name: asset.name,
      url: asset.url,
      downloadUrl: asset.browser_download_url,
      size: asset.size,
    })),
  };
}

export async function getReleaseByVersion(version: string): Promise<Release> {
  console.log(chalk.blue(`Fetching release ${version} from GitHub...`));
  const tag = version.startsWith('release-') ? version : `release-${version}`;
  const response = await fetch(`${RELEASE_API_BASE}/tags/${tag}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch release ${version}: ${response.statusText}`);
  }

  const data: any = await response.json();
  
  return {
    version: data.tag_name.replace('release-', ''),
    tag: data.tag_name,
    publishedAt: data.published_at,
    assets: data.assets.map((asset: any) => ({
      name: asset.name,
      url: asset.url,
      downloadUrl: asset.browser_download_url,
      size: asset.size,
    })),
  };
}

export async function downloadBinary(
  downloadUrl: string,
  destinationPath: string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
  console.log(chalk.blue(`Downloading from ${downloadUrl}...`));
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });

  const response = await fetch(downloadUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
  let downloadedSize = 0;

  const fileStream = createWriteStream(destinationPath);
  
  if (response.body) {
    response.body.on('data', (chunk: Buffer) => {
      downloadedSize += chunk.length;
      if (onProgress) {
        onProgress(downloadedSize, totalSize);
      }
    });

    await pipeline(response.body, fileStream);
  }

  console.log(chalk.green(`Downloaded to ${destinationPath}`));
}

export async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  
  return hash.digest('hex');
}

export async function verifySha256(filePath: string, expectedSha256: string): Promise<boolean> {
  console.log(chalk.blue('Verifying SHA256 checksum...'));
  const actualSha256 = await calculateSha256(filePath);
  const isValid = actualSha256 === expectedSha256;
  
  if (isValid) {
    console.log(chalk.green('✓ SHA256 verification passed'));
  } else {
    console.log(chalk.red('✗ SHA256 verification failed'));
    console.log(chalk.yellow(`  Expected: ${expectedSha256}`));
    console.log(chalk.yellow(`  Actual:   ${actualSha256}`));
  }
  
  return isValid;
}

export async function setExecutablePermissions(filePath: string): Promise<void> {
  if (process.platform !== 'win32') {
    console.log(chalk.blue('Setting executable permissions...'));
    await fs.chmod(filePath, 0o755);
    console.log(chalk.green('✓ Executable permissions set'));
  }
}

export function getPlatformAssetName(platform: 'linux' | 'darwin-arm64' | 'windows', version: string): string {
  switch (platform) {
    case 'linux':
      return `BunProxy-${version}-linux`;
    case 'darwin-arm64':
      return `BunProxy-${version}-darwin-arm64`;
    case 'windows':
      return `BunProxy-${version}-windows.exe`;
  }
}

// Known SHA256 checksums for version 0.0.5
export const KNOWN_SHA256: Record<string, string> = {
  'BunProxy-0.0.5-linux': 'd434473fd65932da0681c63b32aea8dc23c9d0d76f415b2367c3b87aa9c66567',
  'BunProxy-0.0.5-darwin-arm64': '8ad79a2b0bcc1a51d38d30bfcdaec612c5e76409108ddea0ef9bcb6762e758d4',
  'BunProxy-0.0.5-windows.exe': '0c84d61975875b78dca9f3ed920bf9463da366a0816fa3a791b04667613be8e7',
};

export function getKnownSha256(assetName: string): string | undefined {
  return KNOWN_SHA256[assetName];
}
