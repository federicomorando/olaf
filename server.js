
require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const passport = require('passport');
const expressSession = require('express-session');
const SessionStore = require('express-session-sequelize')(expressSession.Store);

const { sequelize } = require('./database');

const sequelizeSessionStore = new SessionStore({
    db: sequelize,
});

// Setting up express
const app = express();

// Setting up additional components
app.use(morgan('common'));
app.use('/', express.static('./app'));
app.use(bodyParser.json());
app.use(expressSession({
    secret: process.env.SESSION_SECRET || 'secret',
    store: sequelizeSessionStore,
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

/*
// Get routes
MongoClient.connect("mongodb://localhost:27017/", (err, client) => {

    if(err)
        require('./routes.js')(app, passport);
    else
        require('./routes.js')(app, passport, client.db('arco'));

    // Notify server uptime
    let server = app.listen(3646, () => {
        console.log('Server listening at http://localhost:%s', 3646);
    });

});
*/

require('./routes.js')(app, passport);

const server = app.listen(3646, 'localhost', () => {
    const host = server.address().address;
    const usesPort = server.address().port;
    console.log('Server listening at http://%s:%s', host, usesPort);
});
