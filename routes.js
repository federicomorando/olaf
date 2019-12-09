// Requirements
const express        = require('express');
const bodyParser     = require('body-parser');
const nodeRequest    = require('request');
const promiseRequest = require('request-promise');
const fs             = require('fs');

// Modules
let queries          = null;
let parser           = null;
let config           = null;
let Config           = require('./users/beweb/config').Config;

// Token validation
function validateToken(token) {

    // Get valid tokens
    let validTokens = ['cobis', 'aaso', 'amt', 'cai', 'cmus', 'dssp',
                       'fga', 'ibmp', 'inaf', 'inrim', 'oato', 'plev',
                       'slvm', 'toas', 'beweb'];

    // Check if token is valid
    return validTokens.includes(token);

}

module.exports = function(app) {

    // Setting up express
    app.use('/', express.static('./app'));
    app.use('/get/beweb/static', express.static('./app'));

    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());

    // Token middleware
    app.all(['/api/v1/:token/*', '/get/:token/*'], (request, response, next) => {

        // Get token
        let token = request.params.token;

        // Validate token
        if (validateToken(token)) {

            // Load user config
            if(!config)
                config = new Config(JSON.parse(fs.readFileSync(`./app/js/config/${token}.json`)));

            // Load modules
            queries = require('./users/' + token + '/queries');
            parser = require('./users/' + token + '/parser');

            // Initialize configuration
            parser.configInit(config);

            // Next route
            next();

        } else {
            // Set not allowed response
            response.status(403);
            response.send('Not allowed to read this resource.');
        }

    });

    // Frontend
    app.get(['/get/:token/author/', '/get/:token/author/:authorId'], (request, response) => {
        response.sendFile('author.html', {root: __dirname + '/app/views'});
    });

    // API
    app.get(['/api/v1/:token/author/', '/api/v1/:token/author/:authorId'], (request, response) => {

        // Compose author query
        let queryAuthor = queries.authorSelect(request.params.authorId);

        // Make request
        nodeRequest(queryAuthor, (err, res, body) => {

            // Handle and send author
            let author = parser.parseAuthor(JSON.parse(body));

            // Query options
            let requests = queries.authorOptions(author.name.trim(), '');
            // Map requests to make Promise
            requests = requests.map(query => promiseRequest(query));

            // Make options queries
            Promise.all(requests).then((bodies) => {
                // Parse result
                parser.parseAuthorOptions(author, bodies.map(body => JSON.parse(body)), (options) => {
                    // Send back options and author response
                    response.json({'author': author, 'options': options});
                });
            });

        });

    });

    app.get('/api/v1/:token/config/', (request, response) => {

        // Send configuration object
        response.json(config.getConfig())

    });

    app.get('/api/v1/:token/author-options/', (request, response) => {

        // Get parameters
        let firstName = request.query.firstName;
        let lastName = request.query.lastName;

        // Get requests
        let requests = queries.authorOptions(firstName, lastName);
        // Map requests to make Promise
        requests = requests.map(query => promiseRequest(query));

        // Make options queries
        Promise.all(requests).then((bodies) => {
            // Parse result
            parser.parseAuthorOptions(bodies.map(body => JSON.parse(body)), (res) => {
                // Send back options response
                response.json(res);
            });
        });

    });

    app.post('/api/v1/:token/author-matches/', (request, response) => {

        // Get requests
        let requests = queries.authorLink(request.body);
        // Map requests to make Promise
        requests = requests.map(req => promiseRequest(req));

        // Send requests
        Promise.all(requests).then((data) => {
            // Send response
            response.redirect('/get/' + request.params.token + '/author');
        })

    });

    app.post('/api/v1/:token/author-skip/', (request, response) => {

        // Compose query
        let requests = queries.authorSkip(request.body);

        // Send requests
        /*nodeRequest(requests, (err, res, body) => {
            // Send response
            response.json({'status': 'success'});
        });*/

        response.json({'skipped': true});

    });

};
