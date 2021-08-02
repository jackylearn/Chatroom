const passport = require('passport')
const bcrypt = require('bcrypt')


module.exports = (app, myDataBase) => {
  app.route('/')
    .get((req, res) => {
      res.render('./pug/index', {
        title: 'Connected to Database', 
        message: 'Please login',
        showLogin: true,
        showRegistration: true,
        showSocialAuth: true});
    });

  app.route('/register')
    .post(async (req, res, next) => {
      try {
          const hash = await bcrypt.hashSync(req.body.password, 12);
          myDataBase.findOne({username: req.body.username}, (err, user) => {
            if (err) return next(err)
            if (user) return res.redirect('/')
            myDataBase.insertOne({
              username: req.body.username,
              password: hash
            }, (err, doc) => {
              if (err) return res.redirect('/')
              // the inserted document is held within the ops property
              next(null, doc.ops[0])
            })
          })
        } catch {
          res.redirect('/')
        }
      }, passport.authenticate('local', {
        failureRedirect: '/',
        successRedirect: '/profile'
      })
    )
  
  app.route('/login')
    .post(passport.authenticate('local', {
        failureRedirect: '/',
        successRedirect: '/profile'
      })
    )

  app.route('/profile')
    .get(ensureAuthenticated, (req, res) => {
      res.render('./pug/profile', {
        username: req.user.username
      })
    })

  app.route('/logout')
    .get((req, res) => {
      req.logout();
      res.redirect('/');
    })

  // login with Github
  app.route('/auth/github')
    .get(passport.authenticate('github'))


  app.route('/auth/github/callback')
    .get(passport.authenticate('github', {
        failureRedirect: '/',
      }), (req, res) => {
        req.session.user_id = req.user.id;
        res.redirect('/chat');
      }
    )

  app.route('/chat')
    .get(ensureAuthenticated, (req, res) => {
      res.render('./pug/chat', {
        user: req.user
      })
    })


//--------------------------------------------------
  // handle missing page
  app.use((req, res, next) => {
    res.status(404)
      .type('text')
      .send('Not Found')
  })
}

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated())
    return next()
  res.redirect('/')
}

