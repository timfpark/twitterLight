var nitrogen = require('nitrogen')
  , Twitter = require('twitter')
  , TwitterAnalyzer = require('./twitterAnalyzer');

var fetchInterval;
var lastHue;

var session;
var params;

var twitter;
var tweetAnalyzer;

var computeHueFromMetric = function(metric) {
    session.log.info('initial metric: ' + metric);

    metric *= 2;

    metric = Math.min(metric, 4.0);
    metric = Math.max(metric, 0.0);
    session.log.info('final metric: ' + metric);

    return 46920 - 11730 * metric;
};

var update = function() {
    tweetAnalyzer.update(session, function(metric) {

        var hue = computeHueFromMetric(metric);
        if (!lastHue) lastHue = hue;

        session.log.info('final hue value of: ' + hue);

        var STEPS = 4;

        var hueStep = (hue - lastHue) / STEPS;
        var tsStep = (params.update_interval * 1000) / STEPS;

        var now = new Date();
        var messages = [];

        for (var idx=1; idx <= STEPS; idx++) {

          var executeAt = new Date(now.getTime() + tsStep * (idx-1));
          var expiresAt = new Date(executeAt.getTime() + 15 * 60 * 1000);

          var cmd = new nitrogen.Message({
                type: 'lightCommand',
                ts:   executeAt,
                to:   params.light_id,
                body: {
                    on: true,
                    bri: 255,
                    hue: Math.floor(lastHue + hueStep * idx),
                    sat: 255
                },
                expires: expiresAt
          });

          messages.push(cmd);
        }

        nitrogen.Message.sendMany(session, messages, function(err) {
          if (err) return session.log.error('sending lightCommands failed: ' + err);
        });

        lastHue = hue;
    });
};

var start = function(s, p) {
    session = s;
    params = p;

    ['twitter_consumer_key', 'twitter_consumer_secret', 'twitter_access_token_key', 'twitter_access_token_secret',
     'light_id', 'twitter_query', 'measurement_interval', 'average_interval', 'update_interval'].forEach(function(key) {
        if (!params[key]) {
            session.log.error('required parameter ' + key +' not supplied.');
            return process.exit(0);            
        }
    });

    twitter = new Twitter({
        consumer_key:         params.twitter_consumer_key, 
        consumer_secret:      params.twitter_consumer_secret,
        access_token_key:     params.twitter_access_token_key,
        access_token_secret:  params.twitter_access_token_secret, 
    });

    tweetAnalyzer = new TwitterAnalyzer({
        twitter:              twitter,
        query:                params.twitter_query,
        measurement_interval: params.measurement_interval,
        average_interval:     params.average_interval
    });

    update();
    fetchInterval = setInterval(update, params.update_interval * 1000);
};

var stop = function() {
    clearInterval(fetchInterval);
};

module.exports = {
    start: start,
    stop: stop
};