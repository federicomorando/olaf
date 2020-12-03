const isValidUTF8 = require('utf-8-validate');
const fs = require('fs');
const tmp = require('tmp');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Op } = require('sequelize');

const { User, Job, Source, Item, Candidate, Action, Log } = require('./database');
const { JobTypes, SourceTypes } = require('./config');
const mailer = require('./mailer');

// Upload
const uploadFile = async (req, res) => {
    if (req.is('text/csv')) {
        if (isValidUTF8(req.body)) {
            const file = tmp.fileSync();
            fs.writeSync(file.fd, req.body);
            fs.closeSync(file.fd);
            res.json({ "path": file.name });
        } else {
            res.sendStatus(400);
        }
    } else {
        res.sendStatus(412);
    }
};

// Job
const getJob = async (req, res) => {
    if (req.params.id === '_all') {
        const jobs = await Job.findAll();
        res.json(jobs);
    } else if (req.params.id === '_types') {
        res.json(JobTypes);
    } else {
        const jobId = parseInt(req.params.id);
        if (isNaN(jobId)) {
            res.sendStatus(400);
            return;
        }
        const job = await Job.findOne({ where: { job_id: jobId }, include: Source });
        if (job === null) {
            res.sendStatus(404);
        } else {
            res.json(job);
        }
    }
};

const createJob = async (req, res) => {
    try {
        const job = await Job.create(req.body);
        res.json(job);
    } catch (e) {
        console.error(e);
        res.sendStatus(400);
    }
};

// Source
const getSource = async (req, res) => {
    if (req.params.id === '_types') {
        res.json(SourceTypes);
    } else {
        const sourceId = parseInt(req.params.id);
        if (isNaN(sourceId)) {
            res.sendStatus(400);
            return;
        }
        const source = await Source.findOne({ where: { source_id: sourceId }, include: Job });
        if (source === null) {
            res.sendStatus(404);
        } else {
            res.json(source);
        }
    }
};

const createSource = async (req, res) => {
    try {
        const source = await Source.create(req.body);
        res.json(source);
    } catch (e) {
        console.error(e);
        res.sendStatus(400);
    }
};

const deleteSource = async (req, res) => {
    const sourceId = parseInt(req.params.id);
    if (isNaN(sourceId)) {
        res.sendStatus(400);
        return;
    }
    try {
        // TODO
        await Source.destroy({ where: { source_id: sourceId } });
        res.sendStatus(200);
    } catch (e) {
        console.error(e);
        res.sendStatus(400);
    }
};

// Log
const getLog = async (req, res) => {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
        res.sendStatus(400);
        return;
    }
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    try {
        const logs = await Log.findAll({ where: { job_id: jobId }, order: [['timestamp', 'DESC']], limit: limit, offset: offset });
        res.json(logs);
    } catch (e) {
        console.error(e);
        res.sendStatus(400);
    }
};

// Item
const getItem = async (req, res) => {
    const jobAlias = req.params.alias;
    const job = await Job.findOne({ where: { alias: jobAlias } });
    if (job == null) {
        res.sendStatus(400);
        return;
    }
    const itemUri = req.query.uri;
    if (itemUri != null) {
        // Get a specific item
        const item = await Item.findOne({ where: { job_id: job.job_id, item_uri: itemUri }, include: Candidate });
        if (item == null) {
            res.sendStatus(404);
        } else {
            res.json(item);
        }
    } else {
        // Get the next item
        const core = require('./cores/' + job.job_type);
        const nextItem = await core.nextItem(job);
        if (nextItem == null) {
            res.sendStatus(404);
        } else {
            nextItem.lock_timestamp = new Date();
            await nextItem.save();
            res.json(nextItem);
        }
    }
};

const saveItem = async (req, res) => {
    const jobAlias = req.params.alias;
    const job = await Job.findOne({ where: { alias: jobAlias } });
    if (job == null) {
        res.sendStatus(400);
        return;
    }
    const core = require('./cores/' + job.job_type);
    core.saveItem(req, res);
};

// User
const createUser = async (req, res) => {
    // Password must be valid
    if (!req.body.password || req.body.password == '') {
        res.sendStatus(400);
        return;
    }
    const hash = await bcrypt.hash(req.body.password, 10);
    const token = crypto.randomBytes(64).toString('hex');
    try {
        await User.create({
            email: req.body.email,
            password: hash,
            token: token,
            display_name: req.body.display_name
        });
        // Do not await this
        mailer.sendVerifyEmail(req.body.email, token).catch((e) => { console.error(e); });
        res.sendStatus(200);
    } catch (e) {
        console.error(e);
        res.sendStatus(400);
    }
};

const sendVerifyEmail = async (req, res) => {
    // Email must be valid
    if (!req.body.email || req.body.email == '') {
        res.sendStatus(400);
        return;
    }
    const user = await User.findOne({ where: { email: req.body.email, is_verified: false } });
    if (user == null) {
        res.sendStatus(404);
    } else {
        // Do not await this
        mailer.sendVerifyEmail(user.email, user.token).catch((e) => { console.error(e); });
        res.sendStatus(200);
    }
};

const verifyEmail = async (req, res) => {
    const user = await User.findOne({ where: { token: req.params.token, is_verified: false } });
    if (user == null) {
        res.sendStatus(404);
    } else {
        user.is_verified = true;
        await user.save();
        res.redirect('/login?verify=true');
    }
};

const checkEmail = async (req, res) => {
    const user = await User.findOne({ where: { email: req.params.email } });
    if (user == null) {
        res.sendStatus(200);
    } else {
        res.sendStatus(410);
    }
};

const sendResetEmail = async (req, res) => {
    // Email must be valid
    if (!req.body.email || req.body.email == '') {
        res.sendStatus(400);
        return;
    }
    const user = await User.findOne({ where: { email: req.body.email, is_verified: true } });
    if (user == null) {
        res.sendStatus(404);
    } else {
        user.token = crypto.randomBytes(64).toString('hex');
        user.is_password_reset = true;
        user.last_password_update = new Date();
        await user.save();
        // Do not await this
        mailer.sendResetEmail(user.email, user.token).catch((e) => { console.error(e); });
        res.sendStatus(200);
    }
};

const resetPassword = async (req, res) => {
    // Password must be valid
    if (!req.body.password || req.body.password == '') {
        res.sendStatus(400);
        return;
    }
    const token_limit = new Date();
    token_limit.setHours(token_limit.getHours() - 1);
    const user = await User.findOne({ where: { token: req.params.token, is_password_reset: true, last_password_update: { [Op.gt]: token_limit } } });
    if (user == null) {
        res.sendStatus(404);
    } else {
        user.password = await bcrypt.hash(req.body.password, 10);
        user.is_password_reset = false;
        user.last_password_update = new Date();
        await user.save();
        res.sendStatus(200);
    }
};

module.exports = {
    uploadFile,
    getJob,
    createJob,
    getSource,
    createSource,
    deleteSource,
    getLog,
    getItem,
    saveItem,
    createUser,
    sendVerifyEmail,
    verifyEmail,
    sendResetEmail,
    resetPassword,
    checkEmail
};