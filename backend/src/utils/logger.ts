import fs from 'fs';
import path from 'path';

export interface LogDestination {
  log: (message: string) => void;
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
  }
  log(message: string) {
    this.stream.write(message + '\n');
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
}

const logFilePath = path.join(process.cwd(), 'logs', 'app.log');
const logger = new Logger([
  new ConsoleDestination(),
  new FileDestination(logFilePath)
]);

export default logger;
