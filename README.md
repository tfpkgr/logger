# @tfpkgr/logger

## Overview

`@tfpkgr/logger` is a colorful, context-rich logger that includes file name, function name, and line number with each log. It is styled by log level for better readability and debugging.

## Installation

```bash
npm install @tfpkgr/logger
```

## Usage

### Basic Example

```typescript
import Logger from '@tfpkgr/logger';

const log = new Logger();

log.info('This is an informational message');
log.warn('This is a warning');
log.error('This is an error');
log.success('Operation successful!');
log.debug('Debugging details');
```

### Advanced Features

#### Setting Global Log Level

```typescript
Logger.setLogLevel('DEBUG');
```

#### File Logging

Enable or disable file logging and set the log directory:

```typescript
Logger.setFileLogging(true);
Logger.setLogDirectory('./logs');
```

#### Child Loggers with Trace

Create child loggers with optional trace information:

```typescript
const parentLogger = new Logger('Parent');
const childLogger = parentLogger.child('Child', true);

childLogger.info('This is a child logger message');
```

#### Timer Logging

Measure execution time using timers:

```typescript
log.timeStart('process');
// ... some operations ...
log.timeEnd('process');
```

#### Custom Log Levels

Log messages with custom levels:

```typescript
log.log('TRACE', 'This is a trace message');
log.log('FATAL', 'This is a fatal error');
```

## API Reference

### Logger Class

-   **`info(...messages: unknown[])`**: Logs an informational message.
-   **`warn(...messages: unknown[])`**: Logs a warning message.
-   **`error(...messages: unknown[])`**: Logs an error message.
-   **`success(...messages: unknown[])`**: Logs a success message.
-   **`debug(...messages: unknown[])`**: Logs a debug message.
-   **`verbose(...messages: unknown[])`**: Logs a verbose message.
-   **`fatal(...messages: unknown[])`**: Logs a fatal error message.
-   **`timeStart(label: string)`**: Starts a timer with a label.
-   **`timeEnd(label: string)`**: Ends a timer and logs the duration.

For more details, refer to the source code in `src/index.ts`.
