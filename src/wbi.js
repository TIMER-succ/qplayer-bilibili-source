"use strict";

var http = require("./http");

var MIXIN = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5,
  49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55,
  40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57,
  62, 11, 36, 20, 34, 44, 52
];

var cachedMixin = "";
var cachedDay = "";

function dayKey() {
  var now = new Date();
  return now.getFullYear() + "-" + now.getMonth() + "-" + now.getDate();
}

function tokenFromUrl(url) {
  var clean = String(url || "").split("?")[0];
  var slash = clean.lastIndexOf("/");
  var dot = clean.lastIndexOf(".");
  if (dot <= slash) return "";
  return clean.substring(slash + 1, dot);
}

function mixinKey(raw) {
  var out = "";
  var i;
  for (i = 0; i < MIXIN.length; i++) {
    var ch = raw.charAt(MIXIN[i]);
    if (ch) out += ch;
  }
  return out.slice(0, 32);
}

function mixin() {
  var today = dayKey();
  if (cachedMixin && cachedDay === today) return Promise.resolve(cachedMixin);
  var ts = Math.floor(Date.now() / 1000);
  return http.hmacSha256Hex("XgwSnGZ1p", "ts" + ts).then(function (hexSign) {
    return http.get("/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket", {
      key_id: "ec02",
      hexsign: hexSign,
      "context[ts]": String(ts),
      csrf: ""
    }, {
      method: "POST",
      anonymous: true,
      userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0"
    });
  }).then(function (data) {
    var nav = data.nav || {};
    var img = tokenFromUrl(nav.img);
    var sub = tokenFromUrl(nav.sub);
    if (!img || !sub) throw new Error("未能获取 WBI 密钥");
    cachedMixin = mixinKey(img + sub);
    cachedDay = today;
    return cachedMixin;
  });
}

function sign(params) {
  return mixin().then(function (key) {
    var signed = {};
    Object.keys(params || {}).forEach(function (name) {
      if (params[name] !== undefined && params[name] !== null) signed[name] = params[name];
    });
    signed.wts = String(Math.round(Date.now() / 1000));
    var names = Object.keys(signed).sort();
    var parts = [];
    var i;
    for (i = 0; i < names.length; i++) {
      var name = names[i];
      var value = String(signed[name]).replace(/[!'()*]/g, "");
      signed[name] = value;
      parts.push(encodeURIComponent(name) + "=" + encodeURIComponent(value));
    }
    return http.md5Hex(parts.join("&") + key).then(function (rid) {
      signed.w_rid = rid;
      return signed;
    });
  });
}

module.exports = {sign: sign};
