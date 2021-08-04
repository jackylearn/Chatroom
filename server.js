'use strict';
require('dotenv').config();
const express = require('express');
// const bodyParser = require('body-parser')
const myDB = require('./connection');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
const session = require('express-session');
const passport = require('passport')
const routes = require('./routes.js')
const auth = require('./auth.js')

const passportSocketIo = require('passport.socketio')
const cookieParser = require('cookie-parser')
const MongoStore = require('connect-mongo')(session)
const store = new MongoStore({ url: process.env.MONGO_URI })

const app = express();
const http = require('http').createServer(app)
const io = require('socket.io')(http)

app.set('view engine', 'pug')

fccTesting(app); //For FCC testing purposes
app.use('/public', express.static(process.cwd() + '/public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  // https://www.npmjs.com/package/express-session
  // How do I know if this is necessary for my store? The best way to know is to check with your store if it implements the touch method. If it does, then you can safely set resave: false. If it does not implement the touch method and your store sets an expiration date on stored sessions, then you likely need resave: true.
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use(passport.initialize());
app.use(passport.session());

const onAuthorizeSuccess = (data, accept) => {
  console.log('successful connection to socket.io')
  accept(null, true)
}

const onAuthorizeFail = (data, message, error, accept) => {
  if (error) throw new Error(message)
  console.log('failed connection to socket.io:', message)
  accept(null, false)
}

io.use(
  passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: 'express.sid',
    secret: process.env.SESSION_SECRET,
    store: store,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail
  })
)


myDB(async client => {
  const myDataBase = await client.db('test').collection('user')

  routes(app, myDataBase)
  auth(app, myDataBase)

  
  let currentUsers = 0;
  io.on('connection', socket => {
    console.log('A user has connected')

    // there is no request in keys of socket object, how to obtain the username??
    let username = socket.request.user.name

    io.emit('user', {
      name: socket.request.user.name, // <----
      currentUsers: ++currentUsers,
      connected: true
    });

    console.log('user ' + socket.request.user.name  /* <---- */ + ' connected')

    socket.on('disconnect', () => {
        console.log('A user has disconnected')
        io.emit('user', {
          name: socket.request.user.name, // <----
          currentUsers: --currentUsers,
          connected: false
        });
    })

    socket.on('chat message', (msg) => {
      io.emit('chat message', {
        name: socket.request.user.name, // <----
        message: msg
      })
    })

  })



}).catch(e => {
  app.route('/').get((req, res) => {
    res.render('pug', {
      title: e,
      message: 'Unable to login'
    })
  })
})


const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log('Listening on port ' + PORT);
});

// app.listen(PORT, () => {
//   console.log('Listening on port ' + PORT);
// });

