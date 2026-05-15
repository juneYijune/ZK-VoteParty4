var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var partyOrgsRouter = require('./routes/party-orgs');
var partyUsersRouter = require('./routes/party-users');
var voteActionRouter = require('./routes/voteAction');
var voteRecordsRouter = require('./routes/vote-records');
var systemLogsRouter = require('./routes/system-logs');
var vcRouter = require('./routes/vc');
var zkRouter = require('./routes/zk');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/api/party-orgs', partyOrgsRouter);
app.use('/api/party-users', partyUsersRouter);
app.use('/api/voteAction', voteActionRouter);
app.use('/api/vote-records', voteRecordsRouter);
app.use('/api/system-logs', systemLogsRouter);
app.use('/api/vc', vcRouter);
app.use('/api/zk', zkRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
