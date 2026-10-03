"use strict";

var WEEKLY_COVER = "https://s1.hdslb.com/bfs/static/jinkela/popular/assets/icon_weekly.png";
var RANK_COVER = "https://s1.hdslb.com/bfs/static/jinkela/popular/assets/icon_rank.png";
var PRECIOUS_COVER = "https://s1.hdslb.com/bfs/static/jinkela/popular/assets/icon_history.png";

var BOARDS = [
  ["0", "all", "全站"],
  ["3", "all", "音乐"],
  ["1", "all", "动画"],
  ["119", "all", "鬼畜"],
  ["168", "all", "国创相关"],
  ["129", "all", "舞蹈"],
  ["4", "all", "游戏"],
  ["36", "all", "知识"],
  ["188", "all", "科技"],
  ["234", "all", "运动"],
  ["223", "all", "汽车"],
  ["160", "all", "生活"],
  ["211", "all", "美食"],
  ["217", "all", "动物圈"],
  ["155", "all", "时尚"],
  ["5", "all", "娱乐"],
  ["181", "all", "影视"],
  ["0", "origin", "原创"],
  ["0", "rookie", "新人"]
];

function isArray(value) {
  return Object.prototype.toString.call(value) === "[object Array]";
}

function httpsUrl(value) {
  value = String(value || "").trim();
  if (value.indexOf("//") === 0) return "https:" + value;
  if (value.indexOf("http://") === 0) return "https://" + value.substring(7);
  return value;
}

function thumbUrl(value) {
  var url = httpsUrl(value);
  if (!/^https:\/\/i\d\.hdslb.com\/bfs\//.test(url)) return "";
  if (url.indexOf("@") >= 0) return url;
  return url.split("?")[0] + "@140w_140h.webp";
}

function decodeText(value) {
  var text = String(value || "").replace(/<[^>]+>/g, "");
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (all, body) {
    var code;
    if (body.charAt(0) === "#") {
      code = body.charAt(1) === "x" || body.charAt(1) === "X"
        ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!isFinite(code) || code <= 0 || code > 65535) return all;
      return String.fromCharCode(code);
    }
    if (body === "amp") return "&";
    if (body === "lt") return "<";
    if (body === "gt") return ">";
    if (body === "quot") return "\"";
    if (body === "apos") return "'";
    if (body === "nbsp") return " ";
    return all;
  });
}

function durationToSec(duration) {
  if (typeof duration === "number" && isFinite(duration)) return duration > 0 ? Math.floor(duration) : 0;
  if (typeof duration !== "string" || !duration) return 0;
  var parts = duration.split(":");
  var sec = 0;
  var i;
  for (i = 0; i < parts.length; i++) sec = sec * 60 + (Number(parts[i]) || 0);
  return sec > 0 ? Math.floor(sec) : 0;
}

function songId(bvid, aid, cid) {
  var base = bvid ? String(bvid) : (aid ? "av" + aid : "");
  if (!base) return "";
  return cid ? base + "#" + cid : base;
}

function parseSongId(id) {
  id = String(id || "");
  var hash = id.indexOf("#");
  var base = hash >= 0 ? id.substring(0, hash) : id;
  var cid = hash >= 0 ? id.substring(hash + 1) : "";
  var bvid = "";
  var aid = "";
  if (base.indexOf("BV") === 0) bvid = base;
  else if (base.indexOf("av") === 0) aid = base.substring(2);
  else if (/^\d+$/.test(base)) aid = base;
  return {bvid: bvid, aid: aid, cid: cid};
}

function artistRef(id, name) {
  name = decodeText(name);
  if (!id || !name) return null;
  return {id: String(id), name: name};
}

function song(raw) {
  raw = raw || {};
  var owner = raw.owner || {};
  var upper = raw.upper || {};
  var bvid = raw.bvid || "";
  var aid = raw.aid || (!bvid ? raw.id : "");
  var cid = raw.cid || "";
  var id = songId(bvid, aid, cid);
  var title = decodeText(raw.title || raw.part || "");
  if (!id || !title) return null;
  var author = artistRef(raw.mid || owner.mid || upper.mid, raw.author || owner.name || upper.name);
  var cover = raw.pic || raw.cover || raw.artwork || "";
  var item = {
    id: id,
    title: title,
    durationMs: durationToSec(raw.duration != null ? raw.duration : raw.length) * 1000,
    artworkUrl: httpsUrl(cover),
    artworkThumbUrl: thumbUrl(cover)
  };
  if (author) item.artists = [author];
  if (bvid || aid) item.album = {id: bvid || ("av" + aid), name: title};
  return item;
}

function songs(list) {
  var out = [];
  if (!isArray(list)) return out;
  var i;
  for (i = 0; i < list.length; i++) {
    var item = song(list[i]);
    if (item) out.push(item);
  }
  return out;
}

function pagesOf(view) {
  view = view || {};
  var pages = isArray(view.pages) && view.pages.length ? view.pages : [{
    cid: view.cid, part: view.title, duration: view.duration
  }];
  var owner = view.owner || {};
  var cover = view.pic || "";
  var albumName = decodeText(view.title || "");
  var albumId = view.bvid || (view.aid ? "av" + view.aid : "");
  var out = [];
  var i;
  for (i = 0; i < pages.length; i++) {
    var page = pages[i] || {};
    var title = pages.length > 1 ? decodeText(page.part || albumName) : albumName;
    var id = songId(view.bvid, view.aid, page.cid || view.cid);
    if (!id || !title) continue;
    var item = {
      id: id,
      title: title,
      durationMs: durationToSec(page.duration != null ? page.duration : view.duration) * 1000,
      artworkUrl: httpsUrl(cover),
      artworkThumbUrl: thumbUrl(cover),
      album: {id: albumId, name: albumName || title}
    };
    var author = artistRef(owner.mid, owner.name);
    if (author) item.artists = [author];
    out.push(item);
  }
  return out;
}

function album(raw) {
  var item = song(raw);
  if (!item || !item.album) return null;
  var published = Number(raw.pubdate || raw.created || 0);
  var value = {
    id: item.album.id,
    name: item.title,
    artworkUrl: item.artworkUrl,
    artworkThumbUrl: item.artworkThumbUrl,
    artists: item.artists || [],
    trackCount: 1,
    description: decodeText(raw.description || raw.desc || "")
  };
  if (published > 0) value.publishTimeMs = published * 1000;
  return value;
}

function albums(list) {
  var out = [];
  if (!isArray(list)) return out;
  var i;
  for (i = 0; i < list.length; i++) {
    var item = album(list[i]);
    if (item && item.id && item.name) out.push(item);
  }
  return out;
}

function artist(raw) {
  raw = raw || {};
  var name = decodeText(raw.uname || raw.name || "");
  if (!raw.mid || !name) return null;
  var face = raw.upic || raw.face || "";
  return {
    id: String(raw.mid),
    name: name,
    artworkUrl: httpsUrl(face),
    artworkThumbUrl: thumbUrl(face),
    description: decodeText(raw.usign || raw.sign || ""),
    songCount: Number(raw.videos || raw.archive_count || 0) || 0,
    albumCount: 0
  };
}

function artists(list) {
  var out = [];
  if (!isArray(list)) return out;
  var i;
  for (i = 0; i < list.length; i++) {
    var item = artist(list[i]);
    if (item) out.push(item);
  }
  return out;
}

function playlist(id, name, description, artwork, trackCount) {
  return {
    id: id,
    name: name,
    description: description || "",
    artworkUrl: artwork,
    trackCount: trackCount || 0,
    owned: false,
    subscribed: false,
    mutable: false,
    deletable: false
  };
}

function boards() {
  var out = [];
  var i;
  for (i = 0; i < BOARDS.length; i++) {
    out.push(playlist("rank:" + BOARDS[i][0] + ":" + BOARDS[i][1], BOARDS[i][2], "哔哩哔哩排行榜", RANK_COVER, 0));
  }
  return out;
}

function lrcTime(sec) {
  if (typeof sec !== "number" || !isFinite(sec) || sec < 0) sec = 0;
  var minutes = Math.floor(sec / 60);
  var seconds = sec - minutes * 60;
  var whole = Math.floor(seconds);
  var frac = Math.floor((seconds - whole) * 100 + 0.5);
  if (frac >= 100) {
    frac -= 100;
    whole += 1;
  }
  if (whole >= 60) {
    whole -= 60;
    minutes += 1;
  }
  return pad(minutes, 2) + ":" + pad(whole, 2) + "." + pad(frac, 2);
}

function pad(value, width) {
  var text = String(value);
  while (text.length < width) text = "0" + text;
  return text;
}

function subtitleToLrc(body) {
  if (!isArray(body)) return "";
  var lines = [];
  var i;
  for (i = 0; i < body.length; i++) {
    var cue = body[i] || {};
    var content = decodeText(cue.content || "").replace(/[\r\n]+/g, " ").trim();
    if (!content) continue;
    var from = typeof cue.from === "number" ? cue.from : parseFloat(cue.from);
    lines.push("[" + lrcTime(from) + "]" + content);
  }
  return lines.join("\n");
}

function streamHost(url) {
  var match = /^https?:\/\/([^\/:?#]+)/i.exec(String(url || ""));
  return match ? match[1].toLowerCase() : "";
}

function streamPort(url) {
  var match = /^https?:\/\/[^\/:?#]+:(\d+)/i.exec(String(url || ""));
  return match ? match[1] : "";
}

function streamScore(url) {
  var host = streamHost(url);
  var port = streamPort(url);
  var standard = !port || port === "443" || port === "80";
  if (!host) return 100;
  if (/\.bilivideo\.com$/.test(host) && standard) return 0;
  if (/\.akamaized\.net$/.test(host) && standard) return 1;
  if (/\.bilivideo\.cn$/.test(host) && standard && host.indexOf("mcdn.") < 0) return 2;
  if (/\.bilivideo\.com$/.test(host) || /\.akamaized\.net$/.test(host)) return 4;
  if (/\.bilivideo\.cn$/.test(host)) return 5;
  return 50;
}

function streamUrl(item) {
  if (!item) return "";
  if (typeof item === "string") item = {url: item};
  var candidates = [];
  function add(value) {
    var i;
    if (!value) return;
    if (isArray(value)) {
      for (i = 0; i < value.length; i++) add(value[i]);
      return;
    }
    candidates.push(httpsUrl(value));
  }
  add(item.baseUrl);
  add(item.base_url);
  add(item.url);
  add(item.backupUrl);
  add(item.backup_url);
  var best = "";
  var bestScore = 101;
  var i;
  for (i = 0; i < candidates.length; i++) {
    var score = streamScore(candidates[i]);
    if (score < bestScore) {
      bestScore = score;
      best = candidates[i];
    }
  }
  return best;
}

function deadlineMs(url) {
  var match = /[?&]deadline=(\d+)/.exec(String(url || ""));
  if (!match) return 0;
  var sec = Number(match[1]);
  if (!isFinite(sec) || sec < 1000000000) return 0;
  return sec * 1000;
}

module.exports = {
  WEEKLY_COVER: WEEKLY_COVER,
  PRECIOUS_COVER: PRECIOUS_COVER,
  isArray: isArray,
  httpsUrl: httpsUrl,
  thumbUrl: thumbUrl,
  decodeText: decodeText,
  parseSongId: parseSongId,
  song: song,
  songs: songs,
  pagesOf: pagesOf,
  albums: albums,
  artists: artists,
  playlist: playlist,
  boards: boards,
  subtitleToLrc: subtitleToLrc,
  streamUrl: streamUrl,
  deadlineMs: deadlineMs
};
