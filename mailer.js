const nodemailer = require('nodemailer');
const mg = require('nodemailer-mailgun-transport');

const transporter = nodemailer.createTransport(mg({
    auth: {
        api_key: process.env.MAILGUN_KEY,
        domain: 'synapta.io'
    },
    host: 'api.eu.mailgun.net'
}));

function sendVerifyEmail(destination, token) {
    return transporter.sendMail({
        from: { name: 'OLAF', address: 'olaf@synapta.io' },
        to: destination,
        subject: 'Attiva il tuo account su OLAF',
        html: `<p>Benvenuto in OLAF!</p>
        <p>Dopo aver verificato il tuo account potrai iniziare a collegare le entità di OLAF con la Linked Data Cloud. Clicca sul bottone sottostante per verificare la tua email:</p>
        <p>
            <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                    <td>
                        <a href="https://olaf.synapta.io/api/v2/user/verify/${token}" target="_blank" style="font-size: 16px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 3px; background-color: #4285f4; border-top: 12px solid #4285f4; border-bottom: 12px solid #4285f4; border-right: 18px solid #4285f4; border-left: 18px solid #4285f4; display: inline-block;">Clicca QUI</a>
                    </td>
                </tr>
            </table>
        </p>
        <p>Collaborare a OLAF è semplice. Scegli il candidato migliore tra le proposte, se non lo trovi clicca su salta.</p>
        <p>Buon divertimento,</p>
        <p>Il Team di OLAF</p>`
    });
}

function sendResetEmail(destination, token) {
    return transporter.sendMail({
        from: 'olaf@synapta.io',
        to: destination,
        subject: 'Reimposta la tua password su OLAF',
        html: `<p>Clicca sul bottone sottostante per modificare la password del tuo account su OLAF:</p>
        <p>
            <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                    <td>
                        <a href="https://olaf.synapta.io/password?reset=${token}" target="_blank" style="font-size: 16px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 3px; background-color: #4285f4; border-top: 12px solid #4285f4; border-bottom: 12px solid #4285f4; border-right: 18px solid #4285f4; border-left: 18px solid #4285f4; display: inline-block;">Clicca QUI</a>
                    </td>
                </tr>
            </table>
        </p>
        <p>Buon divertimento,</p>
        <p>Il Team di OLAF</p>`
    });
}

module.exports = {
    sendVerifyEmail,
    sendResetEmail
};