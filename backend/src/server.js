var http = require('http');
var debug = require('debug')('backend:server');
var path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

var app = require('./app');
var eventListener = require('./services/eventListener.service');

var port = normalizePort(process.env.PORT || '3001');
app.set('port', port);

var server = http.createServer(app);

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// 启动事件监听器（仅实时监听，不自动同步历史事件）
var rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
var contractAddress = process.env.CONTRACT_ADDRESS;

if (contractAddress) {
  eventListener.initEventListener(rpcUrl, contractAddress);
  console.log('事件监听器已启动，监听合约:', contractAddress);
  console.log('提示: 如需同步历史事件，请运行: node sync-historical-events.js');
  
  // 启动定时同步任务（每 30 秒同步一次历史事件）
  // setInterval(async () => {
  //   try {
  //     console.log('[定时任务] 开始同步历史事件...');
  //     await eventListener.syncHistoricalEvents(rpcUrl, contractAddress);
  //     console.log('[定时任务] 历史事件同步完成');
  //   } catch (e) {
  //     console.error('[定时任务] 同步历史事件失败:', e.message);
  //   }
  // }, 120000); // 120 秒
} else {
  console.warn('未配置 CONTRACT_ADDRESS，事件监听器未启动');
}

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  debug('Listening on ' + bind);
  console.log('后端服务已启动，监听端口:', port);
}
