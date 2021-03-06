'use strict';
var async = require('async');
var _ = require('lodash');

/**
 * Webhook handler to award badges based on courses
 * Courses "Code" must correspond to the badge slug
 * @param  {Object} certificate contains all the info, header/user/course passed
 * ie: {"header":{"source":"LearnUpon","version":1,"webhookId":2213843,"attempt":2,"lastAttemptAt":"2016-09-01T10:33:32Z","webHookType":"course_completion","signature":"5736605a1627415455de6f7ca50e7e9d"},"user":{"userId":12345,"lastName":null,"firstName":null,"email":"qq@example.com","username":null,"customData":null},"enrollmentId":42,"courseId":42,"courseName":"CoderDojo Ethos: Implementation and Practice","courseReferenceCode":"coderdojo-ethos:-implementation-and-practice","courseMetaData":null,"modules":[{"id":42,"type":"scorm","name":"CoderDojo Ethos: Implementation and Practice","status":"passed","percentage":100.0,"dateCompleted":null,"attempts":null,"isKnowledgeCheck":false}],"credits":[],"courseAccessExpiresAt":null,"certification":false,"certificationName":null,"certExpiresAt":null,"wasRecertified":false,"dateEnrolled":"2016-08-29T12:02:38Z","dateStarted":"2016-09-01T10:30:50Z","dateCompleted":"2016-09-01T10:32:28Z","percentage":100,"enrollmentStatus":"passed","hasAttemptsRemaining":false}
 */
function awardLMSBadge (args, cb) {
  var seneca = this;
  var plugin = args.role;
  var certif = args;
  var user = certif.user;

  function checkTestStatus (waterfallCb) {
    if (certif.header.webHookType !== 'course_completion') {
      return cb(null, {ok: false, why: 'Unhandled webhook'});
    }
    if (!_.every(certif.modules, {'status': 'passed'}) &&
      !_.every(certif.modules, {'status': 'completed'}) &&
      !_.includes(['completed', 'passed'], certif.enrollmentStatus) ) {
      return cb(null, {ok: false, why: 'Unhandled status'});
    }
    waterfallCb(null, certif.courseReferenceCode);
  }

  function getBadge (badgeName, waterfallCb) {
    seneca.act({role: 'cd-badges', cmd: 'getBadge', slug: badgeName},
      function (err, badge) {
        if (err) return cb(err);
        waterfallCb(null, badge);
    });
  }

  function getUser (badge, waterfallCb) {
    seneca.act({role: 'cd-users', cmd: 'list', query: {lmsId: user.userId}},
      function (err, sysUser) {
        if (err) return cb(err);
        if (_.isEmpty(sysUser)) return cb(null, {ok: false, why: 'LMSUser not found'});
        return waterfallCb(null, sysUser[0], badge);
    });
  }

  function awardBadge (sysUser, badge, waterfallCb) {
    var applicationData = {
      user: sysUser,
      badge: badge.badge,
      emailSubject: 'You have been awarded a new CoderDojo digital badge!'
    };
    seneca.act({role: 'cd-badges', cmd: 'sendBadgeApplication',
        applicationData: applicationData,
        user: {id: null}
      },
      function (err, user) {
        if (err) return cb(err);
        waterfallCb();
    });
  }


  async.waterfall([
    checkTestStatus,
    getBadge,
    getUser,
    awardBadge
  ], cb);

}

module.exports = awardLMSBadge;
