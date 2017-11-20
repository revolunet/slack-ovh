const config = require('../config')
const descriptions = require('../descriptions')
const ovh = require('ovh')(config.ovh)
const express = require('express')
const router = express.Router()
const verification = require('../middlewares/slack')

const specialRedirections = ['contact']

function fillDescription(id) {
  const description = descriptions[id] || 'Ajoutez votre description ici 👉 https://github.com/sgmap/slack-ovh/blob/master/descriptions.json'
  return `*${id}*: ${description}`
}

function sendOk(res, mailingList, email) {
  return () => {
    return res.send({
      text: `Inscription de *${email}* à la liste *${mailingList}* réussie.`,
      mrkdwn: true,
      response_type: 'ephemeral'
    })
  }
}

function sendError(res) {
  return (err) => {
    return res.send({
      text: `Erreur: \`${JSON.stringify(err)}\`.`,
      mrkdwn: true,
      response_type: 'ephemeral'
    })
  }
}

function toText(list) {
  return list.reduce((acc, item) => {
    return acc + `- ${fillDescription(item)}\n`
  }, 'Listes de diffusions existantes:\n')
}

function addSpecialRedirections(list) {
  return list.concat(specialRedirections)
}

function list(res) {
  return ovh.requestPromised('GET', `/email/domain/beta.gouv.fr/mailingList`)
    .then(addSpecialRedirections)
    .then(toText)
    .then(text => res.send({
      text,
      mrkdwn: true,
      response_type: 'ephemeral'
    }))
}

function help(res) {
  return res.send({
    text: `Commandes disponibles:\n
    \t\`/emails list\`\t\tliste des listes de diffusions existantes
    \t\`/emails join <liste> <email>\`\trejoindre une liste
    \t\`/emails leave <liste> <email>\`\tquitter une liste

    Plus d'infos sur https://github.com/sgmap/slack-ovh`,
    mrkdwn: true,
    response_type: 'ephemeral'
  })
}

function join(res, mailingList, email) {
  if (specialRedirections.indexOf(mailingList) >= 0) {
    // Add redirection
    return ovh.requestPromised('POST', `/email/domain/beta.gouv.fr/redirection`, {
      from: `${mailingList}@beta.gouv.fr`,
      to: email,
      localCopy: false
    })
    .then(sendOk(res, mailingList, email))
    .catch(sendError(res))
  } else {
    // Subscribe from mailing-list
    return ovh.requestPromised('POST', `/email/domain/beta.gouv.fr/mailingList/${mailingList}/subscriber`, { email })
      .then(sendOk(res, mailingList, email))
      .catch(sendError(res))
  }
}

function leave(res, mailingList, email) {
  if (specialRedirections.indexOf(mailingList) >= 0) {
    return res.send({
      text: `Cette commande ne fonctionne pas encore, contactez #incubateur-ops pour obtenir de l'aide`,
      mrkdwn: true,
      response_type: 'ephemeral'
    })

    // Find existing redirection
    // const redirection = {id: null} //TODO
    // Remove redirection
    // return ovh.requestPromised('DELETE', `/email/domain/beta.gouv.fr/redirection/${redirection.id}`)
    //   .then(sendOk(res, mailingList, email))
  } else {
    // Unsubscribe from mailing-list
    return ovh.requestPromised('DELETE', `/email/domain/beta.gouv.fr/mailingList/${mailingList}/subscriber/${email}`)
      .then(_ => {
        return res.send({
          text: `Désinscription de *${email}* à la liste *${mailingList}* réussie.`,
          mrkdwn: true,
          response_type: 'ephemeral'
        })
      })
      .catch(sendError(res))
  }
}

router.post('/', verification, function(req, res, next) {
  if (!req.body || !req.body.text) {
    return help(res)
  }

  let [ cmd, mailingList, email ] = req.body.text.split(' ')

  switch(cmd) {
    case 'join':
      return join(res, mailingList, email)
    case 'leave':
      return leave(res, mailingList, email)
    case 'list':
      return list(res)
    default:
      return help(res)
  }
})

module.exports = router
