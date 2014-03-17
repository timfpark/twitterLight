var nitrogen = require('nitrogen')
  , Twitter = require('twitter')
  , TwitterAnalyzer = require('./twitterAnalyzer');

var fetchInterval;

var session;
var params;

var twitter;
var tweetAnalyzer;

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
        consumer_key: params.twitter_consumer_key, 
        consumer_secret: params.twitter_consumer_secret,
        access_token_key: params.twitter_access_token_key,
        access_token_secret: params.twitter_access_token_secret, 
    });

    tweetAnalyzer = new TwitterAnalyzer({
        twitter: twitter,
        query: params.twitter_query,
        measurement_interval: params.measurement_interval,
        average_interval: params.average_interval
    });

    fetchInterval = setInterval(function() {
        tweetAnalyzer.update(session, function(metric) {
            session.log.info('initial metric: ' + metric);

            metric *= 2;

            metric = Math.min(metric, 4.0);
            metric = Math.max(metric, 0.0);
            session.log.info('final metric: ' + metric);

            var hue = Math.floor(46920 - 11730 * metric);
            session.log.info('sending hue value of: ' + hue);

            new nitrogen.Message({
                  type: '_twitterMetric',
                  body: {
                      query: tweetAnalyzer.query,
                      metric: metric
                  }
            }).send(session);

            new nitrogen.Message({
                  type: 'lightCommand',
                  to: params.light_id,
                  body: {
                      on: true,
                      bri: 255,
                      hue: hue,
                      sat: 255
                  }
            }).send(session);
        });

    }, params.update_interval * 1000);
};

var stop = function() {
    clearInterval(fetchInterval);
};

module.exports = {
    start: start,
    stop: stop
};