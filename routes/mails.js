const config = require('../config')
const descriptions = require('../descriptions')
const ovh = require('ovh')(config.ovh)
const express = require('express')
const router = express.Router()
const Promise = require('bluebird')
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
      mrkdwn: true
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

function list(res, mailingList) {
  if (mailingList) {

    if (specialRedirections.indexOf(mailingList) >= 0) {
      // Should list all redirections with { from: mailingList }
      return sendError(res)('Action impossible pour le moment.')
    }

    return ovh.requestPromised('GET', `/email/domain/beta.gouv.fr/mailingList/${mailingList}/subscriber`)
        .then(list => {
          return list.reduce((acc, item) => {
            return acc + `- ${item}\n`
          }, `Personnes inscrites à ${mailingList}:\n`)
        })
        .then(text => res.send({
          text,
          mrkdwn: true,
          response_type: 'ephemeral'
        }))
  }

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
    \t- \`/emails list\`\t\tliste des listes de diffusions existantes
    \t- \`/emails list nomdelaliste\`\t\tliste des personnes dans la liste nomdelaliste
    \t- \`/emails join nomdelaliste nom.prenom@beta.gouv.fr\`\trejoindre la liste nomdelaliste
    \t- \`/emails leave nomdelaliste nom.prenom@beta.gouv.fr\`\tquitter la liste nomdelaliste

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

function getAllRedirections() {
  return ovh.requestPromised('GET', `/email/domain/beta.gouv.fr/redirection`)
  .then(redirectionIds => {
    const mapper = id => ovh.requestPromised('GET', `/email/domain/beta.gouv.fr/redirection/${id}`)

    return Promise.map(redirectionIds, mapper)
  })
}

function findExistingRedirection(email, mailingList) {
  return (list) => {
    const found = list.find(redirection => {
      return redirection.from === mailingList && redirection.to === email
    })

    if (!found) {
      throw {message: `Impossible de trouver la redirection de ${email} vers ${mailingList}`}
    }
  }
}

function removeRedirection(redirection) {
  return ovh.requestPromised('DELETE', `/email/domain/${domain}/redirection/${redirection.id}`)
}


function leave(res, mailingList, email) {
  if (specialRedirections.indexOf(mailingList) >= 0) {
    getAllRedirections()
      .then(findExistingRedirection(email, mailingList))
      .then(removeRedirection)
      .then(_ => {
        return res.send({
          text: `Suppression de la redirection de *${mailingList}* à *${email}* réussie.`,
          mrkdwn: true
        })
      })
      .catch(sendError(res))
  } else {
    // Unsubscribe from mailing-list
    return ovh.requestPromised('DELETE', `/email/domain/beta.gouv.fr/mailingList/${mailingList}/subscriber/${email}`)
      .then(_ => {
        return res.send({
          text: `Désinscription de *${email}* à la liste *${mailingList}* réussie.`,
          mrkdwn: true
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
      return list(res, mailingList)
    default:
      return help(res)
  }
})

module.exports = router
