function error(err) {
  return {
    text: `Erreur: \`${JSON.stringify(err)}\`.`,
    mrkdwn: true,
    response_type: 'ephemeral'
  }
}

function inChannel(text) {
  return {
    text,
    mrkdwn: true,
    response_type: 'in_channel'
  }
}

function ephemeral(text) {
  return {
    text,
    mrkdwn: true,
    response_type: 'ephemeral'
  }
}

module.exports = {
  error,
  inChannel,
  ephemeral
}
