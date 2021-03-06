/* 
 * Copyright (C) 2015 jdn
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/* global Cesium, angular, vwctl */

var databasename = "tacmapUnitDb";
var storestructure = [
    ['Resources', 'name', false, [['url', 'url', true], ['lastmod', 'lastmod', false], ['data', 'data', false]]],
    ['Scenario', 'name', false, [['data', 'data', false]]]
];
var resources = ['xml/defaultScenario.xml', 'json/files.json'];
var compression = false;
var viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false,
    timeline: false,
    infoBox: true,
    selectionIndicator: true,
    baseLayerPicker: true,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
//    imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
//        url: '//services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
//    }),
//    imageryProvider: new Cesium.ArcGisMapServerImageryProvider({
//        url: '//services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
//    }), 
    /*imageryProvider: new Cesium.BingMapsImageryProvider({
     url: '//dev.virtualearth.net',
     key: 'get-yours-at-https://www.bingmapsportal.com/',
     mapStyle: Cesium.BingMapsStyle.AERIAL
     }),*/ /*imageryProvider: new Cesium.GoogleEarthImageryProvider({
      url: '//earth.localdomain',
      channel: 1008
      }),*/
//    imageryProvider: new Cesium.TileMapServiceImageryProvider({
//        url: 'Cesium/Assets/Textures/NaturalEarthII'
//    }),
// OpenStreetMap tile provider
    imageryProvider: new Cesium.OpenStreetMapImageryProvider({
        url: '/tiles'
    }),
    homeButton: false,
    geocoder: false
});
var scene = viewer.scene;
var xj = new X2JS();
var TacMapUnit = angular.module('TacMapUnit', ['indexedDB']);
TacMapUnit.config(function ($indexedDBProvider) {
    $indexedDBProvider.connection(databasename).upgradeDatabase(1, function (event, db, tx) {
        console.log("initDb");
        for (i = 0; i < storestructure.length; i++) {
            //console.log("add store " + storestructure[i][0] + " key:" + storestructure[i][1] + " autoinc:" + storestructure[i][2]);
            var objectStore = db.createObjectStore(storestructure[i][0], {
                keyPath: storestructure[i][1], autoIncrement: storestructure[i][2]
            });
            var indices = storestructure[i][3];
            for (j = 0; j < indices.length; j++) {
                //console.log("add index " + indices[j][0] + " ref:" + indices[j][1] + " unique:" + indices[j][2]);
                objectStore.createIndex(indices[j][0], indices[j][1], {
                    unique: indices[j][2]
                });
            }
        }
    });
});
// ***** CONTROLLERS ******//
TacMapUnit.controller('viewCtl', function ($indexedDB, $scope, $http, GeoClientService, MsgClientService) {
    var vwctl = this;
    console.log("viewCtl");
    var dB = $indexedDB;
    var ellipsoid = scene.globe.ellipsoid;
    vwctl.unitselected = null;
    //   
    vwctl.entities = [];
    vwctl.networks = [];
    vwctl.loc = [];
    $scope.netselected = [];
    $scope.selscene = {id: 0, value: 'Default Scenario'};
    vwctl.scenarioname = GeoClientService.scenarioname;
    //
    vwctl.lftClickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    vwctl.lftClickHandler.setInputAction(function (mouse) {
        var pickedObject = scene.pick(mouse.position);
        if (Cesium.defined(pickedObject) && pickedObject.id.position !== undefined && pickedObject.id.billboard) {
            vwctl.selectUnit(pickedObject.id);
        } else {
            vwctl.loc = [];
            vwctl.unitselected = null;
            $scope.$apply();
        }
    },
            Cesium.ScreenSpaceEventType.LEFT_CLICK);
    //
    for (i = 0; i < resources.length; i++) {
        syncResource($http, resources[i], dB, vwctl, GeoClientService, $scope);
    }
    vwctl.selectUnit = function (u, zoomto) {
        //console.log(u._id);
        vwctl.unitselected = GeoClientService.sdatasources[$scope.selscene.value].entities.getById(u._id);
        vwctl.loc = vwctl.getLoc(vwctl.unitselected);
        if (zoomto) {
            GeoClientService.sdatasources[$scope.selscene.value].selectedEntity = vwctl.unitselected;
            viewer.selectedEntity = vwctl.unitselected;
            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(vwctl.loc[1], vwctl.loc[0], 10000.0),
                duration: 1
            });
        } else {
            $scope.$apply();
        }
    };
    vwctl.getLoc = function (entity) {
        var cartesian = entity.position.getValue();
        var cartographic = ellipsoid.cartesianToCartographic(cartesian);
        var latitudeString = Cesium.Math.toDegrees(cartographic.latitude);
        var longitudeString = Cesium.Math.toDegrees(cartographic.longitude);
        entity.description = "Location: " + latitudeString + ", " + longitudeString;
        return ([latitudeString, longitudeString]);
    };
    vwctl.showUnit = function (unit) {
        if ($scope.netselected[unit._network]) {
            return $scope.netselected[unit._network].show;
        }
    };
    vwctl.selectNetwork = function (net) {
        //console.log("selectNetwork " + net._name);
        vwctl.entities = GeoClientService.entities;
        if ($scope.netselected[net._name]) {
            if ($scope.netselected[net._name].show === true) {
                $scope.netselected[net._name].show = false;
                MsgClientService.leaveNet(net._name);
            } else {
                $scope.netselected[net._name].show = true;
                $scope.netselected[net._name].network = net._name;
                MsgClientService.joinNet(net._name);
            }
            GeoClientService.setNetViz(vwctl.entities, $scope.netselected);
            return $scope.netselected[net._name].show;
        } else {
            $scope.netselected[net._name] = [];
            $scope.netselected[net._name].show = true;
            $scope.netselected[net._name].network = net._name;
            GeoClientService.setNetViz(vwctl.entities, $scope.netselected);
            MsgClientService.joinNet(net._name);
            return $scope.netselected[GeoClientService.entities, net._name].show;
        }
    };
    vwctl.netSelected = function (net) {
        if ($scope.netselected[net._name]) {
            return $scope.netselected[net._name].show;
        }
    };
    MsgClientService.socket.on('set scenario', function (data) {
        console.log('set scenario');
        dB.openStore("Scenario", function (store) {
            store.upsert({name: data.scenarioname, data: data.scenariodata});
        }).then(function () {
            $scope.selscene.value = data.scenarioname;
            viewer.dataSources.remove(GeoClientService.sdatasources[$scope.selscene.value]);
            vwctl.entities = data.scenariodata.Scenario.Entities.Entity;
            vwctl.networks = data.scenariodata.Scenario.Networks.Network;
            GeoClientService.initGeodesy(data.scenarioname, data.scenariodata, $scope);
            GeoClientService.joinNetworks(vwctl.entities, vwctl.networks, MsgClientService, $scope);
        });
    });
});
TacMapUnit.controller('ClientMesssageCtl', function ($indexedDB, $scope, MsgClientService, GeoClientService) {
    var msgctl = this;
    msgctl.dB = $indexedDB;
    msgctl.messages = [];
    msgctl.moveUnit = function (uid, lat, lon) {
        console.log("moveUnit: " + uid);
        GeoClientService.sdatasources[$scope.selscene.value].entities.getById(uid).position = Cesium.Cartesian3.fromDegrees(lon, lat);
    };
    MsgClientService.socket.on('error', console.error.bind(console));
//    MsgClientService.socket.on('message', console.log.bind(console));
    MsgClientService.socket.on('connection', function (data) {
        console.log("Client Connected " + data.socketid);
        MsgClientService.clientid = data.socketid;
        MsgClientService.socket.emit('client connected', {message: 'client', id: data.socketid});
        msgctl.messages.push({text: "Client Connected"});
    });
    MsgClientService.socket.on('send msg', function (data) {
        //console.log("receive msg " + data.net + ": " + data.message.unit + " " + data.message.position[0] + ", " + data.message.position[1]);
        msgctl.messages.push({text: "POSREP " + data.net + " " + data.message.unit});
        msgctl.moveUnit(data.message.unit, data.message.position[0], data.message.position[1]);
    });
    MsgClientService.socket.on('client disconnected', function (data) {
        console.log("Client disconnected " + data.socketid);
        msgctl.messages.push({text: "Client disconnected"});
    });
    MsgClientService.socket.on('client joined', function (data) {
        //console.log('Joined Network: ' + data.netname);
        msgctl.messages.push({text: 'Joined Network: ' + data.netname});
    });
    MsgClientService.socket.on('client left', function (data) {
        console.log('Left Network: ' + data.netname);
        msgctl.messages.push({text: 'Left Network: ' + data.netname});
    });
    MsgClientService.socket.on('server joined', function (data) {
        //console.log('Server ' + data.serverid + ' Joined Net: ' + data.netname);
        msgctl.messages.push({text: 'Server ' + data.serverid + ' Joined Net: ' + data.netname});
    });
    MsgClientService.socket.on('server left', function (data) {
        console.log('Server ' + data.serverid + ' Left Net: ' + data.netname);
        msgctl.messages.push({text: 'Server ' + data.serverid + ' Left Net: ' + data.netname});
    });
    MsgClientService.socket.on('move unit', function (data) {
        msgctl.moveUnit(data.uid, data.lat, data.lon);
    });
});
TacMapUnit.controller('menuCtrl', function ($scope) {
    //initiate an array to hold all active tabs
    $scope.activeTabs = [];
    //check if the tab is active
    $scope.isOpenTab = function (tab) {
        //check if this tab is already in the activeTabs array
        if ($scope.activeTabs.indexOf(tab) > -1) {
            //if so, return true
            return true;
        } else {
            //if not, return false
            return false;
        }
    };
    //function to 'open' a tab
    $scope.openTab = function (tab) {
        //check if tab is already open
        if ($scope.isOpenTab(tab)) {
            //if it is, remove it from the activeTabs array
            $scope.activeTabs.splice($scope.activeTabs.indexOf(tab), 1);
        } else {
            //if it's not, add it!
            $scope.activeTabs.push(tab);
        }
    };
    //function to leave a tab open if open or open if not
    $scope.leaveOpenTab = function (tab) {
        //check if tab is already open
        if (!$scope.isOpenTab(tab)) {
            //if it is not open, add to array
            $scope.activeTabs.push(tab);
        }
    };
});
// ***** SERVICES ******//
TacMapUnit.factory('GeoClientService', function () {
    var geosvc = {
    };
    geosvc.entities = [];
    geosvc.scenename = null;
    geosvc.sdatasources = [];
    geosvc.initGeodesy = function (scenename, scenariodata, $scope) {
        console.log("initGeodesy " + scenename);
        geosvc.scenename = scenename;
        $scope.selscene.value = scenename;
        geosvc.sdatasources[geosvc.scenename] = new Cesium.CustomDataSource(geosvc.scenename);
        viewer.dataSources.add(geosvc.sdatasources[$scope.selscene.value]);
        //console.log(scenariodata);
        var polygons = scenariodata.Scenario.Polygons.Polygon;
        var entities = scenariodata.Scenario.Entities.Entity;
        geosvc.addPolygons(polygons);
        geosvc.addEntities(entities);
        //console.log(geosvc.movementsegments);
        viewer.zoomTo(geosvc.sdatasources[geosvc.scenename].entities.getById("Default"));
        geosvc.setNetViz(entities, "");
    };
    geosvc.addPolygons = function (polygons) {
        for (i = 0; i < polygons.length; i++) {
            geosvc.addCesiumPolygon(polygons[i]);
        }
    };
    geosvc.addEntities = function (entities) {
        for (i = 0; i < entities.length; i++) {
            geosvc.entities[entities[i]._id] = entities[i];
            geosvc.addCesiumBillBoard(entities[i]);
        }
    };
    geosvc.addCesiumPolygon = function (poly) {
        var loc = poly._locations;
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        //Cartesian wants long, lat
        geosvc.sdatasources[geosvc.scenename].entities.add({
            id: poly._id,
            name: poly._name,
            polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(loc.reverse()),
                outline: true,
                outlineColor: Cesium.Color[poly._color],
                outlineWidth: 2,
                fill: false
            }
        });
    };
    geosvc.addCesiumBillBoard = function (entity) {
        var loc = entity._location;
        loc = loc.replace(/\s|\"|\[|\]/g, "").split(",");
        geosvc.sdatasources[geosvc.scenename].entities.add({
            id: entity._id,
            name: entity._name,
            position: Cesium.Cartesian3.fromDegrees(loc[1], loc[0]),
            billboard: {
                image: entity._icon,
                width: 40,
                height: 25
            },
            label: {
                text: entity._name,
                font: '10pt monospace',
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, 15)
            }
        });
    };
    geosvc.setNetViz = function (e, vwsel) {
        geosvc.entities = e;
        for (i = 0; i < e.length; i++) {
            if (vwsel[e[i]._network] && geosvc.sdatasources[geosvc.scenename].entities.getById(e[i]._id)) {
                if (vwsel[e[i]._network].show) {
                    geosvc.sdatasources[geosvc.scenename].entities.getById(e[i]._id).show = true;
                } else {
                    geosvc.sdatasources[geosvc.scenename].entities.getById(e[i]._id).show = false;
                }
            } else if (geosvc.sdatasources[geosvc.scenename].entities.getById(e[i]._id)) {
                geosvc.sdatasources[geosvc.scenename].entities.getById(e[i]._id).show = false;
            }
        }
    };
    geosvc.joinNetworks = function (entities, networks, msgsvc, $scope) {
        for (e = 0; e < entities.length; e++) {
            if ($scope.netselected[entities[e]._network]) {
                $scope.netselected[entities[e]._network].show === true;
                $scope.netselected[entities[e]._network].network = entities[e]._network;
                geosvc.setNetViz(entities, $scope.netselected);
            } else {
                $scope.netselected[entities[e]._network] = [];
                $scope.netselected[entities[e]._network].show = true;
                $scope.netselected[entities[e]._network].network = entities[e]._network;
                geosvc.setNetViz(entities, $scope.netselected);
            }
        }
        for (n = 0; n < networks.length; n++) {
            msgsvc.joinNet(networks[n]._name);
        }
    };
    return geosvc;
});
TacMapUnit.factory('MsgClientService', function () {
    var msgsvc = {
    };
    msgsvc.clientid;
    msgsvc.scenarioname;
    msgsvc.connected = false;
    msgsvc.sending = false;
    msgsvc.lastSendingTime = 0;
    msgsvc.messagelist = [];
    msgsvc.socket = io();
    // Sends a message
    msgsvc.joinNet = function (netname) {
        if (!msgsvc.messagelist[netname]) {
            msgsvc.messagelist[netname] = [];
        }
        msgsvc.socket.emit('client join', {clientid: msgsvc.clientid, netname: netname});
    };
    msgsvc.leaveNet = function (netname) {
        msgsvc.socket.emit('client leave', {clientid: msgsvc.clientid, netname: netname});
    };
    return msgsvc;
});
TacMapUnit.factory('DlgBx', function ($window, $q) {
    var dlg = {
    };
    dlg.alert = function alert(message) {
        var defer = $q.defer();
        $window.alert(message);
        defer.resolve();
        return (defer.promise);
    };
    dlg.prompt = function prompt(message, defaultValue) {
        var defer = $q.defer();
        // The native prompt will return null or a string.
        var response = $window.prompt(message, defaultValue);
        if (response === null) {
            defer.reject();
        } else {
            defer.resolve(response);
        }
        return (defer.promise);
    };
    dlg.confirm = function confirm(message) {
        var defer = $q.defer();
        // The native confirm will return a boolean.
        if ($window.confirm(message)) {
            defer.resolve(true);
        } else {
            defer.reject(false);
        }
        return (defer.promise);
    };
    return dlg;
});
function syncResource($http, url, dB, vwctl, GeoClientService, $scope) {
    $http.get(url).success(function (resdata, status, headers) {
        var mod = headers()['last-modified'];
        var filename = url.substring(url.lastIndexOf('/') + 1);
        dB.openStore('Resources', function (store) {
            store.getAllKeys().then(function (keys) {
                if (keys.indexOf(filename) === -1) {
                    store.upsert({name: filename, url: url, lastmod: mod, data: resdata});
                } else {
                    store.find(filename).then(function (dbrec) {
                        if (dbrec.lastmod !== mod) {
                            console.log('upsert ' + filename);
                            store.upsert({name: filename, url: url, lastmod: mod, data: resdata});
                        }
                    });
                }
            });
        });
        if (filename === 'defaultScenario.xml') {
            console.log('init geo');
            var spdata = xj.xml_str2json(resdata);
            vwctl.scenario = spdata;
            vwctl.entities = spdata.Scenario.Entities.Entity;
            GeoClientService.initGeodesy("Default", spdata, $scope);
        }
    }).error(function () {
        console.log('Error getting resource');
    });
}