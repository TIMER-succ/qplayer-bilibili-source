"use strict";

var api = require("./api");

function pageArgs(args) {
  var page = Number(args && args.cursor || 1);
  if (!isFinite(page) || page < 1) page = 1;
  var limit = Number(args && args.limit || 20);
  if (!isFinite(limit) || limit < 1) limit = 20;
  if (limit > 20) limit = 20;
  return {
    query: String(args && args.query || "").trim(),
    page: Math.floor(page),
    limit: Math.floor(limit)
  };
}

function emptyPage() {
  return {items: [], nextCursor: ""};
}

module.exports = {
  handlers: {
    searchSongs: function (args) {
      var page = pageArgs(args);
      if (!page.query) return emptyPage();
      return api.searchVideos(page.query, page.page, page.limit);
    },
    searchAlbums: function (args) {
      var page = pageArgs(args);
      if (!page.query) return emptyPage();
      return api.searchAlbums(page.query, page.page, page.limit);
    },
    searchArtists: function (args) {
      var page = pageArgs(args);
      if (!page.query) return emptyPage();
      return api.searchArtists(page.query, page.page, page.limit);
    },
    hotSearch: function () {
      return api.hotSearch();
    },
    home: function (args) {
      return api.home(args || {});
    },
    songDetails: function (args) {
      var ids = args && args.ids || [];
      return api.songDetails(ids);
    },
    playlistDetails: function (args) {
      return api.playlistDetails(args && args.id);
    },
    albumDetails: function (args) {
      return api.albumDetails(args && args.id);
    },
    artistDetails: function (args) {
      return api.artistDetails(args && args.id);
    },
    resolveStream: function (args) {
      return api.resolveStream(args && args.id, args && args.quality);
    },
    lyrics: function (args) {
      return api.lyrics(args && args.id);
    },
    account: function () {
      return api.account();
    },
    userPlaylists: function (args) {
      var limit = Number(args && args.limit || 100);
      if (!isFinite(limit) || limit < 1) limit = 1;
      if (limit > 500) limit = 500;
      return api.userPlaylists(Math.floor(limit));
    },
    share: function (args) {
      return api.share(args || {});
    },
    login: function (args) {
      return api.login(args || {});
    }
  }
};
