import fs from 'fs';
import path from 'path';

export interface LogDestination {
  log: (message: string) => void;
  flush?: () => Promise<void>;
}

class ConsoleDestination implements LogDestination {
  log(message: string) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}

class FileDestination implements LogDestination {
  private stream: fs.WriteStream;
  constructor(filePath: string) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.stream = fs.createWriteStream(filePath, { flags: 'a' });
    this.stream.on('error', (error) => {
      // eslint-disable-next-line no-console
      console.error(`ERROR: Unable to write log file ${filePath}: ${error.message}`);
    });
  }
  log(message: string) {
    this.stream.write(message + '\n');
  }
  flush(): Promise<void> {
    if (this.stream.destroyed) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.stream.once('close', resolve);
      this.stream.end();
    });
  }
}

export class Logger {
  private destinations: LogDestination[] = [];
  constructor(destinations: LogDestination[] = []) {
    this.destinations = destinations;
  }
  addDestination(dest: LogDestination) {
    this.destinations.push(dest);
  }
  log(message: string) {
    this.destinations.forEach(dest => dest.log(message));
  }
  info(message: string) {
    this.log(message);
  }
  error(message: string) {
    this.log(`ERROR: ${message}`);
  }
  async flush() {
    await Promise.all(this.destinations.map(dest => dest.flush?.()));
  }
}

const logFilePath = path.join(process.cwd(), 'logs', 'app.log');
const logger = new Logger([
  new ConsoleDestination(),
  new FileDestination(logFilePath)
]);

export default logger;
