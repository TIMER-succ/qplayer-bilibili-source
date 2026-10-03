"use strict";

var http = require("./http");
var wbi = require("./wbi");
var map = require("./map");

var DM_IMG = "V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ";
var DM_COVER = "QU5HTEUgKE5WSURJQSwgTlZJRElBIEdlRm9yY2UgR1RYIDE2NTAgKDB4MDAwMDFGOTEpIERpcmVjdDNEMTEgdnNfNV8wIHBzXzVfMCwgRDNEMTEpR29vZ2xlIEluYy4gKE5WSURJQS";
var DM_INTER = "{\"ds\":[],\"wh\":[4564,4288,68],\"of\":[401,802,401]}";

function signedGet(path, params, referer) {
  return wbi.sign(params).then(function (signed) {
    return http.get(path, signed, {referer: referer});
  });
}

function search(keyword, page, pageSize, type) {
  return http.get("/x/web-interface/search/type", {
    context: "",
    page: page,
    order: "",
    page_size: pageSize,
    keyword: keyword,
    duration: "",
    tids_1: "",
    tids_2: "",
    __refresh__: "true",
    _extra: "",
    highlight: 1,
    single_column: 0,
    platform: "pc",
    from_source: "",
    search_type: type,
    dynamic_offset: 0
  }, {referer: "https://search.bilibili.com/"}).then(function (data) {
    var result = map.isArray(data.result) ? data.result : [];
    var more = result.length >= pageSize;
    if (data.numResults != null) more = more && Number(data.numResults) > page * pageSize;
    return {result: result, nextCursor: more ? String(page + 1) : ""};
  });
}

function searchVideos(keyword, page, pageSize) {
  return search(keyword, page, pageSize, "video").then(function (data) {
    return {items: map.songs(data.result), nextCursor: data.nextCursor};
  });
}

function searchAlbums(keyword, page, pageSize) {
  return search(keyword, page, pageSize, "video").then(function (data) {
    return {items: map.albums(data.result), nextCursor: data.nextCursor};
  });
}

function searchArtists(keyword, page, pageSize) {
  return search(keyword, page, pageSize, "bili_user").then(function (data) {
    return {items: map.artists(data.result), nextCursor: data.nextCursor};
  });
}

function hotSearch() {
  return signedGet("/x/web-interface/wbi/search/square", {
    limit: "30",
    platform: "web"
  }, "https://search.bilibili.com/").then(function (data) {
    var list = data.trending && data.trending.list || data.list || [];
    var words = [];
    var i;
    if (!map.isArray(list)) return words;
    for (i = 0; i < list.length && words.length < 50; i++) {
      var word = list[i] && (list[i].keyword || list[i].show_name || "");
      if (word) words.push(String(word));
    }
    return words;
  });
}

function viewBy(parsed) {
  var params = parsed.bvid ? {bvid: parsed.bvid} : {aid: parsed.aid};
  if (!parsed.bvid && !parsed.aid) return Promise.reject(new Error("缺少视频 id"));
  return http.get("/x/web-interface/view", params);
}

function ensureCid(parsed) {
  if (parsed.cid && (parsed.bvid || parsed.aid)) return Promise.resolve(parsed);
  return viewBy(parsed).then(function (data) {
    var cid = data.cid;
    var pages = map.isArray(data.pages) ? data.pages : [];
    var i;
    for (i = 0; i < pages.length; i++) {
      if (parsed.cid && String(pages[i].cid) === String(parsed.cid)) cid = pages[i].cid;
    }
    if (!cid && pages.length) cid = pages[0].cid;
    if (!cid) throw new Error("未能获取分P");
    return {bvid: data.bvid || parsed.bvid, aid: String(data.aid || parsed.aid || ""), cid: String(cid)};
  });
}

function listOf(data) {
  if (map.isArray(data)) return data;
  if (data && map.isArray(data.list)) return data.list;
  return [];
}

function ranking(rid, type) {
  return http.get("/x/web-interface/ranking/v2", {rid: rid, type: type}, {
    referer: "https://www.bilibili.com/"
  }).then(function (data) {
    return map.songs(listOf(data));
  });
}

function seriesList() {
  return http.get("/x/web-interface/popular/series/list").then(function (data) {
    var list = map.isArray(data.list) ? data.list : [];
    var out = [];
    var i;
    for (i = 0; i < list.length && i < 8; i++) {
      var item = list[i] || {};
      out.push(map.playlist(
        "series:" + item.number,
        item.subject || item.name || ("第" + item.number + "期"),
        item.name || "",
        map.WEEKLY_COVER,
        0
      ));
    }
    return out;
  });
}

function seriesOne(number) {
  return http.get("/x/web-interface/popular/series/one", {number: number}).then(function (data) {
    return map.songs(listOf(data));
  });
}

function precious() {
  return http.get("/x/web-interface/popular/precious", {page_size: 100, page: 1}).then(function (data) {
    return map.songs(listOf(data));
  });
}

function home(args) {
  if (args && args.operation === "recommendSongs") {
    return ranking("3", "all").then(function (songs) {
      return songs.slice(0, 30);
    }, function () {
      return [];
    });
  }
  if (args && args.operation) return Promise.reject(new Error("未知首页操作"));
  var limit = Number(args && args.limit || 12);
  if (!isFinite(limit) || limit < 1) limit = 12;
  if (limit > 100) limit = 100;
  return seriesList().then(function (weekly) {
    return weekly;
  }, function () {
    return [];
  }).then(function (weekly) {
    return ranking("3", "all").then(function (songs) {
      return {weekly: weekly, songs: songs};
    }, function () {
      return {weekly: weekly, songs: []};
    });
  }).then(function (loaded) {
    var grid = [map.playlist("precious", "入站必刷", "哔哩哔哩入站必刷", map.PRECIOUS_COVER, 0)];
    if (loaded.weekly.length) grid.push(loaded.weekly[0]);
    grid.push(map.playlist("rank:3:all", "音乐", "音乐分区排行", map.boards()[1].artworkUrl, 0));
    var sections = [];
    if (loaded.weekly.length) sections.push({title: "每周必看", playlists: loaded.weekly});
    sections.push({title: "排行榜", playlists: map.boards()});
    return {
      songs: loaded.songs.slice(0, 30),
      playlists: grid.slice(0, limit),
      sections: sections
    };
  });
}

function songDetails(ids) {
  if (!map.isArray(ids)) ids = [];
  return mapSeries(ids, function (id) {
    return viewBy(map.parseSongId(id)).then(function (data) {
      var pages = map.pagesOf(data);
      var wanted = String(id);
      var i;
      for (i = 0; i < pages.length; i++) {
        if (pages[i].id === wanted) return pages[i];
      }
      if (!map.parseSongId(id).cid && pages.length) {
        var first = pages[0];
        first.id = wanted;
        return first;
      }
      return pages.length ? pages[0] : null;
    });
  });
}

function albumDetails(id) {
  var parsed = map.parseSongId(id);
  if (!parsed.bvid && id && String(id).indexOf("BV") === 0) parsed.bvid = String(id).split("#")[0];
  if (!parsed.bvid && !parsed.aid && /^\d+$/.test(String(id))) parsed.aid = String(id);
  return viewBy(parsed).then(function (data) {
    var songs = map.pagesOf(data);
    var owner = data.owner || {};
    var artists = owner.mid && owner.name ? [{id: String(owner.mid), name: map.decodeText(owner.name)}] : [];
    var value = {
      id: data.bvid || (data.aid ? "av" + data.aid : String(id)),
      name: map.decodeText(data.title || "") || String(id),
      artworkUrl: map.httpsUrl(data.pic),
      artworkThumbUrl: map.thumbUrl(data.pic),
      description: map.decodeText(data.desc || ""),
      trackCount: songs.length,
      artists: artists,
      songs: songs
    };
    if (Number(data.pubdate || 0) > 0) value.publishTimeMs = Number(data.pubdate) * 1000;
    return value;
  });
}

function artistWorks(mid) {
  var page = 1;
  var songs = [];
  var total = 0;
  function next() {
    return signedGet("/x/space/wbi/arc/search", {
      mid: String(mid),
      ps: "30",
      tid: "0",
      pn: String(page),
      index: "0",
      special_type: "",
      web_location: "333.1387",
      order_avoided: "true",
      order: "pubdate",
      keyword: "",
      platform: "web",
      dm_img_list: "[]",
      dm_img_str: DM_IMG,
      dm_cover_img_str: DM_COVER,
      dm_img_inter: DM_INTER
    }, "https://space.bilibili.com/" + mid + "/video").then(function (data) {
      var vlist = data.list && data.list.vlist || [];
      var info = data.page || {};
      total = Number(info.count || total || 0);
      songs = songs.concat(map.songs(vlist));
      if (!vlist.length || songs.length >= total || songs.length >= 90 || page >= 3) {
        return {songs: songs, total: total || songs.length};
      }
      page += 1;
      return next();
    });
  }
  return next();
}

function artistDetails(id) {
  var mid = String(id || "");
  if (!mid) return Promise.reject(new Error("缺少 UP 主 id"));
  return http.get("/x/web-interface/card", {mid: mid}).then(function (data) {
    var card = data.card || {};
    var face = card.face || "";
    var profile = {
      id: mid,
      name: map.decodeText(card.name || "") || "UP主",
      artworkUrl: map.httpsUrl(face),
      artworkThumbUrl: map.thumbUrl(face),
      description: map.decodeText(card.sign || ""),
      songCount: Number(data.archive_count || 0) || 0,
      albumCount: 0,
      songs: []
    };
    return artistWorks(mid).then(function (works) {
      profile.songs = works.songs;
      if (works.total) profile.songCount = works.total;
      return profile;
    }, function () {
      return profile;
    });
  }, function () {
    return artistWorks(mid).then(function (works) {
      var name = "UP主";
      if (works.songs.length && works.songs[0].artists && works.songs[0].artists.length) {
        name = works.songs[0].artists[0].name;
      }
      return {
        id: mid,
        name: name,
        songCount: works.total || works.songs.length,
        albumCount: 0,
        songs: works.songs
      };
    });
  });
}

function playlistDetails(id) {
  id = String(id || "");
  if (id.indexOf("fav:") === 0 || /^\d+$/.test(id)) return favorite(id.replace(/^fav:/, ""));
  if (id === "precious") {
    return precious().then(function (songs) {
      var item = map.playlist("precious", "入站必刷", "哔哩哔哩入站必刷", map.PRECIOUS_COVER, songs.length);
      item.songs = songs;
      return item;
    });
  }
  if (id.indexOf("series:") === 0) {
    var number = id.substring(7);
    return seriesOne(number).then(function (songs) {
      var item = map.playlist(id, "每周必看 " + number, "", map.WEEKLY_COVER, songs.length);
      item.songs = songs;
      return item;
    });
  }
  if (id.indexOf("rank:") === 0) {
    var rest = id.substring(5);
    var colon = rest.indexOf(":");
    if (colon <= 0) return Promise.reject(new Error("未知排行榜"));
    var rid = rest.substring(0, colon);
    var type = rest.substring(colon + 1);
    return ranking(rid, type).then(function (songs) {
      var name = "排行榜";
      var boards = map.boards();
      var i;
      for (i = 0; i < boards.length; i++) {
        if (boards[i].id === id) name = boards[i].name;
      }
      var item = map.playlist(id, name, "哔哩哔哩排行榜", boards.length ? boards[0].artworkUrl : "", songs.length);
      item.songs = songs;
      return item;
    });
  }
  return Promise.reject(new Error("未知歌单"));
}

function favorite(mediaId) {
  var page = 1;
  var songs = [];
  var info = null;
  function next() {
    return http.get("/x/v3/fav/resource/list", {
      media_id: mediaId,
      platform: "web",
      ps: 20,
      pn: page
    }).then(function (data) {
      info = data.info || info;
      var medias = map.isArray(data.medias) ? data.medias : [];
      songs = songs.concat(map.songs(medias));
      if (!data.has_more || !medias.length || songs.length >= 1000 || page >= 50) return songs;
      page += 1;
      return next();
    });
  }
  return next().then(function () {
    var meta = info || {};
    var total = Number(meta.media_count || songs.length) || songs.length;
    var intro = map.decodeText(meta.intro || "");
    if (total > songs.length) intro = (intro ? intro + "\n" : "") + "已加载前 " + songs.length + " 首，共 " + total + " 首";
    var item = map.playlist(
      "fav:" + mediaId,
      meta.title || "收藏夹",
      intro,
      map.httpsUrl(meta.cover || (songs[0] && songs[0].artworkUrl) || ""),
      songs.length
    );
    item.songs = songs;
    item.owned = true;
    return item;
  });
}

function nav() {
  return http.get("/x/web-interface/nav");
}

function account() {
  return http.loadUserCookie().then(function (cookie) {
    if (!cookie || cookie.indexOf("SESSDATA=") < 0) return {loggedIn: false};
    return nav().then(function (data) {
      var level = data.level_info || {};
      var face = data.face || "";
      return {
        loggedIn: !!data.isLogin,
        id: data.mid ? String(data.mid) : "",
        displayName: data.uname || "",
        avatarUrl: map.httpsUrl(face),
        membershipTier: clamp(data.vip_type, 1000),
        level: clamp(level.current_level, 100000),
        signature: ""
      };
    });
  });
}

function userPlaylists(limit) {
  return account().then(function (profile) {
    if (!profile.loggedIn || !profile.id) return [];
    return http.get("/x/v3/fav/folder/created/list-all", {up_mid: profile.id}).then(function (data) {
      var list = map.isArray(data.list) ? data.list : [];
      var out = [];
      var i;
      for (i = 0; i < list.length && out.length < limit; i++) {
        var folder = list[i] || {};
        if (!folder.id || !folder.title) continue;
        var item = map.playlist(
          "fav:" + folder.id,
          folder.title,
          map.decodeText(folder.intro || ""),
          map.httpsUrl(folder.cover || ""),
          Number(folder.media_count || 0) || 0
        );
        item.owned = true;
        out.push(item);
      }
      return out;
    });
  });
}

function audioCandidates(dash, quality) {
  var high = quality !== "standard" && quality !== "low";
  var found = [];
  if (high && dash.flac && dash.flac.audio) found.push(dash.flac.audio);
  if (high && dash.dolby && map.isArray(dash.dolby.audio) && dash.dolby.audio.length) {
    found.push(dash.dolby.audio[dash.dolby.audio.length - 1]);
  }
  var audios = map.isArray(dash.audio) ? dash.audio.slice() : [];
  audios.sort(function (a, b) {
    return Number(a.bandwidth || 0) - Number(b.bandwidth || 0);
  });
  if (audios.length) found.push(high ? audios[audios.length - 1] : audios[0]);
  return found;
}

function streamOf(url, mime) {
  var expires = map.deadlineMs(url);
  var stream = {
    url: url,
    headers: {
      "User-Agent": http.UA,
      "Referer": "https://www.bilibili.com/"
    },
    mimeType: mime,
    trial: false,
    cacheable: expires > Date.now()
  };
  if (expires) stream.expiresAtMs = expires;
  return stream;
}

function playOnce(parsed, fnval, quality) {
  var params = parsed.bvid ? {bvid: parsed.bvid} : {aid: parsed.aid};
  params.cid = parsed.cid;
  params.fnval = fnval;
  params.fourk = 1;
  return http.get("/x/player/playurl", params, {
    referer: "https://www.bilibili.com/video/" + (parsed.bvid || ("av" + parsed.aid)) + "/"
  }).then(function (data) {
    var dash = data.dash || {};
    var candidates = audioCandidates(dash, quality);
    var i;
    for (i = 0; i < candidates.length; i++) {
      var url = map.streamUrl(candidates[i]);
      if (url) return streamOf(url, "audio/mp4");
    }
    var durl = map.isArray(data.durl) ? data.durl : [];
    if (durl.length) {
      var progressive = map.streamUrl(durl[0]);
      if (progressive) return streamOf(progressive, "video/mp4");
    }
    throw new Error("没有可用的音频流");
  });
}

function resolveStream(id, quality) {
  return ensureCid(map.parseSongId(id)).then(function (parsed) {
    return playOnce(parsed, 4048, quality).then(function (stream) {
      return stream;
    }, function () {
      return playOnce(parsed, 16, quality);
    });
  });
}

function fetchSubtitle(url, referer) {
  var absolute = map.httpsUrl(url);
  if (!absolute) return Promise.resolve("");
  return http.request({url: absolute, referer: referer}).then(function (body) {
    return map.subtitleToLrc(body && body.body);
  }, function () {
    return "";
  });
}

function pickSubtitle(list, pattern) {
  var i;
  for (i = 0; i < list.length; i++) {
    if (pattern.test(String(list[i].lan || ""))) return list[i];
  }
  return null;
}

function lyrics(id) {
  return http.loadUserCookie().then(function (cookie) {
    if (!cookie || cookie.indexOf("SESSDATA=") < 0) return {assets: []};
    var parsed = map.parseSongId(id);
    return ensureCid(parsed).then(function (full) {
      var referer = "https://www.bilibili.com/video/" + (full.bvid || ("av" + full.aid)) + "/";
      var params = {
        cid: String(full.cid),
        web_location: "1315873",
        dm_img_list: "[]",
        dm_img_str: DM_IMG,
        dm_cover_img_str: DM_COVER,
        dm_img_inter: DM_INTER
      };
      if (full.aid) params.aid = String(full.aid);
      else params.bvid = full.bvid;
      return signedGet("/x/player/wbi/v2", params, referer).then(function (data) {
        var list = data.subtitle && data.subtitle.subtitles || [];
        if (!map.isArray(list) || !list.length) return {assets: []};
        var zh = pickSubtitle(list, /zh|cn/i) || list[0];
        var en = pickSubtitle(list, /^en/i);
        return fetchSubtitle(zh.subtitle_url, referer).then(function (original) {
          return fetchSubtitle(en && en !== zh ? en.subtitle_url : "", referer).then(function (translation) {
            var assets = [];
            if (original) assets.push({format: "lrc", role: "original", text: original});
            if (translation) assets.push({format: "lrc", role: "translation", text: translation});
            return {assets: assets};
          });
        });
      });
    });
  }).then(function (result) {
    return result;
  }, function () {
    return {assets: []};
  });
}

function share(args) {
  var kind = String(args.kind || "song");
  var id = String(args.id || "");
  if (kind === "song") {
    var parsed = map.parseSongId(id);
    if (parsed.bvid) return "https://www.bilibili.com/video/" + parsed.bvid;
    if (parsed.aid) return "https://www.bilibili.com/video/av" + parsed.aid;
  }
  if (kind === "album") {
    if (id.indexOf("BV") === 0) return "https://www.bilibili.com/video/" + id.split("#")[0];
    if (id.indexOf("av") === 0 || /^\d+$/.test(id)) {
      return "https://www.bilibili.com/video/" + (id.indexOf("av") === 0 ? id : "av" + id);
    }
  }
  if (kind === "artist" || kind === "user") return "https://space.bilibili.com/" + encodeURIComponent(id);
  if (kind === "playlist") {
    if (id.indexOf("fav:") === 0) return "https://www.bilibili.com/medialist/detail/ml" + id.substring(4);
    if (/^\d+$/.test(id)) return "https://www.bilibili.com/medialist/detail/ml" + id;
    if (id === "precious") return "https://www.bilibili.com/v/popular/history";
    if (id.indexOf("series:") === 0) return "https://www.bilibili.com/v/popular/weekly?num=" + id.substring(7);
    if (id.indexOf("rank:") === 0) return "https://www.bilibili.com/v/popular/rank/all";
  }
  throw new Error("不支持分享该媒体类型");
}

function login(args) {
  var operation = args && args.operation;
  if (operation === "methods") {
    return [{
      id: "cookie",
      type: "credential",
      label: "Cookie",
      instructions: "在浏览器登录 bilibili.com 后，从开发者工具的请求头复制完整 Cookie（需包含 SESSDATA）。Cookie 只加密保存在本机。",
      credentialLabel: "Cookie"
    }];
  }
  if (operation === "submit") {
    return http.saveUserCookie(args.credential || "").then(function () {
      return account();
    }).then(function (profile) {
      if (!profile.loggedIn) throw new Error("登录凭据无效");
      return {id: "cookie", methodId: "cookie", status: "success", account: profile};
    }, function (error) {
      var message = String(error && error.message || error);
      if (message.indexOf("SESSDATA") >= 0 || message.indexOf("过长") >= 0) {
        return {id: "cookie", methodId: "cookie", status: "failed", message: message};
      }
      return http.clearUserCookie().then(function () {
        return {id: "cookie", methodId: "cookie", status: "failed", message: message};
      }, function () {
        return {id: "cookie", methodId: "cookie", status: "failed", message: message};
      });
    });
  }
  if (operation === "logout") return http.clearUserCookie();
  if (operation === "begin" || operation === "poll") {
    return Promise.reject(new Error("该登录方式不需要创建挑战"));
  }
  return Promise.reject(new Error("未知登录操作"));
}

function clamp(value, max) {
  var number = Number(value);
  if (!isFinite(number) || number < 0) return 0;
  if (number > max) return max;
  return Math.floor(number);
}

function mapSeries(items, fn) {
  var out = [];
  var index = 0;
  var lastError = null;
  function next() {
    if (index >= items.length) {
      if (!out.length && lastError) return Promise.reject(lastError);
      return Promise.resolve(out);
    }
    var current = items[index];
    index += 1;
    return Promise.resolve().then(function () {
      return fn(current);
    }).then(function (value) {
      if (value) out.push(value);
      return next();
    }, function (error) {
      lastError = error;
      return next();
    });
  }
  return next();
}

module.exports = {
  searchVideos: searchVideos,
  searchAlbums: searchAlbums,
  searchArtists: searchArtists,
  hotSearch: hotSearch,
  home: home,
  songDetails: songDetails,
  albumDetails: albumDetails,
  artistDetails: artistDetails,
  playlistDetails: playlistDetails,
  resolveStream: resolveStream,
  lyrics: lyrics,
  account: account,
  userPlaylists: userPlaylists,
  share: share,
  login: login
};
