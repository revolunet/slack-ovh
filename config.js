const config = {
  token: process.env.SLACK_TOKEN,
  domain: process.env.DOMAIN,
  ovh: {
    appKey: process.env.OVH_APP_KEY,
    appSecret: process.env.OVH_APP_SECRET,
    consumerKey: process.env.OVH_CONSUMER_KEY
  }
}

module.exports = config
