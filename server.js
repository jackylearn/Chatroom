'use strict';
require('dotenv').config();
const express = require('express');
const myDB = require('./connection');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
const session = require('express-session');
const passport = require('passport')
const routes = require('./routes.js')
const auth = require('./auth.js')

const app = express();
const http = require('http').createServer(app)
const io = require('socket.io')(http)

app.set('view engine', 'pug')

fccTesting(app); //For FCC testing purposes
app.use('/public', express.static(process.cwd() + '/public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



const sessionMiddleware = session({ 
  secret: process.env.SESSION_SECRET, 
  resave: true, 
  saveUninitialized: false 
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());


// convert a connect middleware to a Socket.IO middleware
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);

io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));
io.use((socket, next) => {
  if ('user' in socket.request) {
    next();
  } else {
    next(new Error("socket request does not contain user information"));
  }
});

myDB(async client => {
  const myDataBase = await client.db('test').collection('user')
  
  let currentUsers = 0;
  io.on('connection', socket => {
    console.log('A user has connected')

    // sometimes socket.request doesn't contain user info, server will crash due to accessing username of undefined
    io.emit('user', {
      name: socket.request.user.username, // <----
      currentUsers: ++currentUsers,
      connected: true
    });

    console.log('user ' + socket.request.user.username  + ' connected')

    socket.on('disconnect', () => {
        console.log('A user has disconnected')
        io.emit('user', {
          name: socket.request.user.username,
          currentUsers: --currentUsers,
          connected: false
        });
    })

    socket.on('chat message', (msg) => {
      io.emit('chat message', {
        name: socket.request.user.username, 
        message: msg
      })
    })

  })

  routes(app, myDataBase)
  auth(app, myDataBase)

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
