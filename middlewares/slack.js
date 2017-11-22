const token = require('../config').token

function verification(req, res, next) {
  if (token === req.body.token && 'incubateur-ops' === req.body.channel_name) {
    next();
  } else {
    res.send({
      text: 'Veuillez effectuer cette commande dans le channel #incubateur-ops',
      mrkdwn: true,
      response_type: 'ephemeral'
    }).status(401);
  }
}

module.exports = verification
