"use strict";

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
var API = "https://api.bilibili.com";
var cachedCookie;
var cookieLoaded = false;
var cachedBuvid = "";

function call(method, args) {
  return qplayer.call(method, args || {});
}

function cleanCookie(value) {
  return String(value || "").replace(/[\r\n]/g, "").trim();
}

function loadUserCookie() {
  if (cookieLoaded) return Promise.resolve(cachedCookie || "");
  return call("credentials.get", {key: "cookie"}).then(function (value) {
    cachedCookie = cleanCookie(value);
    cookieLoaded = true;
    return cachedCookie;
  });
}

function saveUserCookie(value) {
  var cookie = cleanCookie(value);
  if (cookie.length > 8000) return Promise.reject(new Error("Cookie 过长"));
  if (cookie.indexOf("SESSDATA=") < 0) return Promise.reject(new Error("Cookie 中缺少 SESSDATA"));
  var previous = cachedCookie;
  var previousLoaded = cookieLoaded;
  cachedCookie = cookie;
  cookieLoaded = true;
  return call("credentials.put", {key: "cookie", value: cookie}).then(function () {
    return cookie;
  }, function (error) {
    cachedCookie = previous;
    cookieLoaded = previousLoaded;
    return Promise.reject(error);
  });
}

function clearUserCookie() {
  return call("credentials.delete", {key: "cookie"}).then(function () {
    cachedCookie = "";
    cookieLoaded = true;
    return true;
  });
}

function query(params) {
  var parts = [];
  Object.keys(params || {}).forEach(function (key) {
    var value = params[key];
    if (value === undefined || value === null) return;
    parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
  });
  return parts.join("&");
}

function md5Hex(data) {
  return call("crypto.digest", {
    algorithm: "MD5",
    data: String(data),
    dataEncoding: "utf8",
    outputEncoding: "hex"
  });
}

function hmacSha256Hex(key, data) {
  return call("crypto.hmac", {
    algorithm: "HmacSHA256",
    key: String(key),
    keyEncoding: "utf8",
    data: String(data),
    dataEncoding: "utf8",
    outputEncoding: "hex"
  });
}

function anonymousCookie() {
  if (cachedBuvid) return Promise.resolve(cachedBuvid);
  return call("storage.get", {key: "buvid"}).then(function (stored) {
    if (stored) {
      cachedBuvid = cleanCookie(stored);
      if (cachedBuvid) return cachedBuvid;
    }
    return request({url: API + "/x/frontend/finger/spi", anonymous: true}).then(function (body) {
      var data = body.data || {};
      if (!data.b_3 && !data.b_4) return "";
      cachedBuvid = "buvid3=" + (data.b_3 || "") + "; buvid4=" + (data.b_4 || "");
      return call("storage.put", {key: "buvid", value: cachedBuvid}).then(function () {
        return cachedBuvid;
      }, function () {
        return cachedBuvid;
      });
    });
  }, function () {
    return "";
  });
}

function request(options) {
  options = options || {};
  function send(cookie) {
    var headers = {
      "User-Agent": options.userAgent || UA,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Referer": options.referer || "https://www.bilibili.com/",
      "Origin": "https://www.bilibili.com"
    };
    if (cookie) headers.Cookie = cookie;
    var payload = {
      url: options.url,
      method: options.method || "GET",
      headers: headers,
      timeoutMs: options.timeoutMs || 15000
    };
    if (options.body != null) payload.body = String(options.body);
    return call("http.request", payload).then(function (response) {
      var status = Number(response && response.status || 0);
      if (status < 200 || status >= 300) throw new Error("HTTP " + status);
      var text = response && response.body || "";
      if (!text) throw new Error("空响应");
      var body = JSON.parse(text);
      if (body && body.code != null && Number(body.code) !== 0) {
        throw new Error(body.message || body.msg || ("接口错误 " + body.code));
      }
      return body;
    });
  }
  if (options.anonymous) return send("");
  return loadUserCookie().then(function (userCookie) {
    if (userCookie) return send(userCookie);
    return anonymousCookie().then(send);
  });
}

function get(path, params, options) {
  var qs = query(params);
  var opts = {
    url: API + path + (qs ? "?" + qs : ""),
    referer: options && options.referer,
    anonymous: options && options.anonymous,
    userAgent: options && options.userAgent,
    method: options && options.method
  };
  return request(opts).then(function (body) {
    if (body && body.data !== undefined && body.data !== null) return body.data;
    return {};
  });
}

module.exports = {
  UA: UA,
  API: API,
  call: call,
  loadUserCookie: loadUserCookie,
  saveUserCookie: saveUserCookie,
  clearUserCookie: clearUserCookie,
  query: query,
  md5Hex: md5Hex,
  hmacSha256Hex: hmacSha256Hex,
  request: request,
  get: get
};
