function TwitterAnalyzer(config) {
    this.twitter = config.twitter;
    this.query = config.query;
    this.measurementInterval = config.measurement_interval;
    this.averageInterval = config.average_interval;

    this.tweets = {};
    this.earliestTweet = null;
}

TwitterAnalyzer.dateSecondsFromNow = function(seconds) {
    return new Date(new Date().getTime() + seconds * 1000);
};

TwitterAnalyzer.prototype.getAverageCutoff = function() {
    return TwitterAnalyzer.dateSecondsFromNow(-1 * this.averageInterval);
};

TwitterAnalyzer.prototype.getMeasurementCutoff = function() {
    return TwitterAnalyzer.dateSecondsFromNow(-1 * this.measurementInterval);
};

TwitterAnalyzer.prototype.updateTweets = function(callback) {
    var self = this;

    this.twitter.search(this.query, { count: 100 }, function(results) {
        if (!results || !results.statuses) {
            console.log('WARNING: no statuses in result');
            return callback();
        }

        console.log('number of tweets: ' + Object.keys(self.tweets).length);
        results.statuses.forEach(function(tweet) {
            var simplifiedTweet = {
                created_at: new Date(Date.parse(tweet.created_at)),
                id_str: tweet.id_str,
                text: tweet.text
            };

            if (!self.tweets[tweet.id_str]) {
                self.tweets[tweet.id_str] = simplifiedTweet;
                console.log('adding tweet: ' + JSON.stringify(simplifiedTweet));
            }
        });

        self.trimBefore(self.getAverageCutoff());

        console.log('final tweets: ' + JSON.stringify(self.tweets));

        return callback();
    });
};

TwitterAnalyzer.prototype.trimBefore = function(date) {
    var trimmed = {};
    this.earliestTweet = new Date();

    for (var id in this.tweets) {
        var tweet = this.tweets[id];
        if (tweet.created_at >= date) {
            trimmed[tweet.id_str] = tweet;
            if (tweet.created_at < this.earliestTweet) {
                this.earliestTweet = tweet.created_at;
            }
        }
    }

    this.tweets = trimmed;
};

TwitterAnalyzer.prototype.countAfter = function(date) {
    var count = 0;

    for (var id in this.tweets) {
        var tweet = this.tweets[id];
        if (tweet.created_at > date)
            count += 1;
    }

    return count;
};

TwitterAnalyzer.prototype.update = function(session, callback) {
    var self = this;

    this.updateTweets(function() {

        var totalTimeMeasured = Math.floor((new Date() - self.earliestTweet) / 1000);
        session.log.debug('total time measured: ' + totalTimeMeasured);

        totalTimeMeasured = Math.max(1.0, totalTimeMeasured);

        var totalCount = Object.keys(self.tweets).length;
        session.log.debug('total count: ' + totalCount);

        var normalizedTotal = totalCount / totalTimeMeasured;
        session.log.debug('normalized total count (t/s):' + normalizedTotal);

        var measurementCount = self.countAfter(self.getMeasurementCutoff());
        session.log.debug('measurement period count: ' + measurementCount);

        var normalizedMeasurement = measurementCount / self.measurementInterval;
        session.log.debug('normalized measurement count (t/s): ' + normalizedMeasurement);

        var metric;
        if (totalCount !== 0 && self.measurementInterval !== 0)
            metric = (measurementCount / totalCount) * (self.averageInterval / self.measurementInterval);
        else
            metric = 0.0;

        session.log.info('metric: ' + metric);

        return callback(metric);
    });
};

module.exports = TwitterAnalyzer;