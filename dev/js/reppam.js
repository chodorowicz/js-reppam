;(function($, window) {

	window.reppamCallback = function() {
		$(window).trigger('scriptLoaded.reppam');
	};

	//Private Methods
	var priv = {
		init: function() {
			var $this = this,
				paramObj = $this.set.urlParams,
				url = $this.set.mapsURL + '?callback=window.reppamCallback';

			if(typeof google === 'undefined') {

				//If script doesn't exist load the script and continue.
				for(var urlParams in paramObj) {
					url += '&' + urlParams + '=' + paramObj[urlParams];
				}

				//Callback is issued to the window object so that we can access it within this plugin.
				$.ajax({
					url: url,
					dataType: 'script',
					error: function(msg) {
						//essential data
						if($this.set.debug) console.log('Google maps has failed to load, message: ' + msg);
					}
				});

			} else {
				$(window).trigger('scriptLoaded.reppam');
			}

			$(window).on('scriptLoaded.reppam', function() {
				//This recieves the callback from Google maps API.
				priv.getData.apply($this);
			});

		},
		getData: function() {
			var $this = this;

			//Get marker information
			$.ajax({
				url: $this.set.mapData,
				type: 'GET',
				dataType: 'JSON',
				success: function(data) {
					$this.set.mapData = data;
					$this.data('mapData', data);
					priv.renderMap.apply($this);
				},
				error: function(msg) {
					//essential data
					if($this.set.debug) console.log('Markers data has failed to load, message: ', msg);
				}
			});


		},
		renderMap: function() {
			var $this = this,
				zoomLocation,
				swObj,
				neObj,
				bounds;
			
			if($this.set.mapData.countries) {
				//Use GEO_IP data to set right country.
				zoomLocation = $this.set.mapData.countries[$this.set.mapData.currentLocation[0]];

				if($this.set.defaultCountry !== false) {
					//Check that there are markers in that country.
					if(!priv.withinBounds(zoomLocation.sw, zoomLocation.ne, $this.set.mapData.locations)) {
						//Revert to default country if there are no markers
						zoomLocation = $this.set.mapData.countries[$this.set.defaultCountry];
						//alternatively expand bounds...
					}
				}

				swObj = new google.maps.LatLng(zoomLocation.sw.lat, zoomLocation.sw.lng);
				neObj = new google.maps.LatLng(zoomLocation.ne.lat, zoomLocation.ne.lng);

				//Set the bounds using googles functions.
				bounds = new google.maps.LatLngBounds(swObj, neObj);
			} else {
				$this.set.mapOptions.center = new google.maps.LatLng(0, 0);
				$this.set.mapOptions.zoom = 2;
			}
			

			//Initiate map at right location.
			$this.set.map = new google.maps.Map($this[0], $this.set.mapOptions);
			if($this.set.mapData.countries) $this.set.map.fitBounds(bounds);

			$this.data('map', $this.set.map);

			priv.logPosition.apply($this);

			priv.enableEvents.apply($this);
			priv.addMarkers.apply($this);

		},
		enableEvents: function() {
			var $this = this;

			//Current HTML 5 location
			$('#locate-me').on('click', function(e) {
				e.preventDefault();
				var pos,
					$me = $(this);

				$me.addClass('loading');

				priv.getLocation(function(myPosition) {
					priv.addMe.apply($this, [myPosition]);

					$me.removeClass('loading').addClass('loaded');
				});
			});

			//Find nearest store
			$('#nearest').on('click', function(e) {
				e.preventDefault();
				var $nearest = $(this),
					closest = [],
					currentPos,
					storePos,
					bounds;

				$nearest.addClass('loading');

				priv.getLocation(function(myPosition) {
					var crowFlies;

					priv.addMe.apply($this, [myPosition]);

					//Remove potential line already added
					if($this.set.current.crowFlies) $this.set.current.crowFlies.setMap(null);

					$nearest.removeClass('loading').addClass('loaded');

					//Set bounds and zoom.
					closest = priv.findNearest(myPosition, $this.set.mapData.locations);
					currentPos = new google.maps.LatLng(myPosition.lat, myPosition.lng);
					storePos = new google.maps.LatLng(closest[0].data.latitude, closest[0].data.longitude);

					//Line as the crow flies.
					crowFlies = new google.maps.Polyline({
						path: [currentPos, storePos],
						geodesic: true,
						strokeColor: $this.set.strokeColor,
						strokeWeight: 3
					});

					google.maps.event.addListener(crowFlies, 'click', function() {
						bounds = new google.maps.LatLngBounds();
						bounds.extend(currentPos);
						bounds.extend(storePos);
						$this.set.map.fitBounds(bounds);
						priv.logPosition.apply($this);
					});

					crowFlies.setMap($this.set.map);

					if(closest[0].distance < 100) {
						//Set the bounds if close
						bounds = new google.maps.LatLngBounds();
						bounds.extend(currentPos);
						bounds.extend(storePos);
						$this.set.map.fitBounds(bounds);

					} else {
						//Go to store if further away
						$this.set.map.setCenter(storePos);
						$this.set.map.setZoom($this.set.zoomedIn);
					}

					$this.set.current.crowFlies = crowFlies;
					priv.logPosition.apply($this);

				});
				
			});

			$(window).on('resize', function() {
				$this.set.map.setCenter($this.set.center);
				$this.set.map.setZoom($this.set.zoom);
			});

			//Directions to closest store.
			//On ice api allows only 2,500 req/day... Might still be ok.

		},
		addMe: function(myPosition) {
			var $this = this,
				myMarker,
				personMarker = $this.set.personMarker,
				markerOptions = {},
				pos;

			//Remove potential marker already added
			if($this.set.current.position) $this.set.current.position.setMap(null);

			pos = new google.maps.LatLng(myPosition.lat, myPosition.lng);

			markerOptions.position = pos;
			if(personMarker !== false) {
				markerOptions.icon = {};
				//Translate from arrays to google classes
				if(personMarker.url) markerOptions.icon.url = personMarker.url;
				if(personMarker.anchor) markerOptions.icon.anchor = new google.maps.Point(personMarker.anchor[0], personMarker.anchor[1]);
				if(personMarker.origin) markerOptions.icon.origin = new google.maps.Point(personMarker.origin[0], personMarker.origin[1]);
				if(personMarker.size) markerOptions.icon.size = new google.maps.Size(personMarker.size[0], personMarker.size[1]);
				if(personMarker.scaledSize) markerOptions.icon.scaledSize = new google.maps.Size(personMarker.scaledSize[0], personMarker.scaledSize[1]);
			}
			myMarker = new google.maps.Marker(markerOptions);
			
			//Adds a "you are here" marker.
			myMarker.setMap($this.set.map);
			$this.set.map.setCenter(pos);

			google.maps.event.addListener(myMarker, 'click', function() {
				//Only set zoom if zooming in.
				if($this.set.map.getZoom() < $this.set.zoomedIn) {
					$this.set.map.setZoom($this.set.zoomedIn);
				}

				$this.set.map.panTo(this.getPosition());
				priv.logPosition.apply($this);
			});

			$this.set.current.position = myMarker;
		},
		addMarkers: function() {
			var $this = this,
				locations = $this.set.mapData.locations,
				singleMarker = $this.set.singleMarker,
				multipleMarker = $this.set.multipleMarker,
				latLng,
				position,
				marker,
				markers = [],
				markerOptions = {},
				multipleMarkerOptions = {},
				markerCluster;

			//Parse marker data.
			for(var markerData in locations) {
				position = locations[markerData];
				
				if(position.latitude === '' || position.longitude === '') continue;

				latLng = new google.maps.LatLng(position.latitude, position.longitude);
				//https://developers.google.com/maps/documentation/javascript/reference#MarkerOptions

				markerOptions = {
					id: markerData,
					content: locations[markerData].address,
					position: latLng,
					title: locations[markerData].name
				};
				if(singleMarker !== false) {
					markerOptions.icon = {};
					//Translate from arrays to google classes
					if(singleMarker.url) markerOptions.icon.url = singleMarker.url;
					if(singleMarker.anchor) markerOptions.icon.anchor = new google.maps.Point(singleMarker.anchor[0], singleMarker.anchor[1]);
					if(singleMarker.origin) markerOptions.icon.origin = new google.maps.Point(singleMarker.origin[0], singleMarker.origin[1]);
					if(singleMarker.size) markerOptions.icon.size = new google.maps.Size(singleMarker.size[0], singleMarker.size[1]);
					if(singleMarker.scaledSize) markerOptions.icon.scaledSize = new google.maps.Size(singleMarker.scaledSize[0], singleMarker.scaledSize[1]);
				}
				marker = new google.maps.Marker(markerOptions);

				//On each marker have a click event so that you zoom in to the correct level.
				//No event delegation available as these aren't dom elements.
				google.maps.event.addListener(marker, 'click', function() {
					var info = new google.maps.InfoWindow({
							content: this.content
						});
					
					if($this.set.current.infoWindow) $this.set.current.infoWindow.close();

					//Only set zoom if zooming in (not out) and marker has already been clicked once.
					if($this.set.map.getZoom() < $this.set.zoomedIn && this.id === $this.set.current.viewed) {
						$this.set.map.setZoom($this.set.zoomedIn);
					}

					$this.set.map.panTo(this.getPosition());
					info.open($this.set.map, this);
					$this.set.current.infoWindow = info;
					$this.set.current.viewed = this.id;
					priv.logPosition.apply($this);
				});

				markers.push(marker);
			}

			//If MarkerClusterer is defined and loaded on the page use that. 
			// http://google-maps-utility-library-v3.googlecode.com/svn/trunk/markerclustererplus/docs/reference.html
			//Otherwise use google markers.
			if(typeof MarkerClusterer !== 'undefined') {
				markerCluster = new MarkerClusterer($this.set.map, markers, {
					maxZoom: $this.set.zoomedIn - 1
				});
				if(multipleMarker !== false) {

					multipleMarkerOptions = {};
					//Icon values - transpose properties so that they are the same as the other markers
					if(multipleMarker.url) multipleMarkerOptions.url = multipleMarker.url;
					if(multipleMarker.anchor) multipleMarkerOptions.anchorIcon = [multipleMarker.anchor[1], multipleMarker.anchor[0]];
					if(multipleMarker.origin) multipleMarkerOptions.backgroundPosition = '-' + multipleMarker.origin[0] + 'px -' + multipleMarker.origin[1] + 'px';
					if(multipleMarker.size) multipleMarkerOptions.width = multipleMarker.size[0];
					if(multipleMarker.size) multipleMarkerOptions.height = multipleMarker.size[1];
					//Text values - same as markerclustererplus - http://google-maps-utility-library-v3.googlecode.com/svn/trunk/markerclustererplus/docs/reference.html#ClusterIconStyle
					if(multipleMarker.anchorText) multipleMarkerOptions.anchorText = multipleMarker.anchorText;
					if(multipleMarker.fontFamily) multipleMarkerOptions.fontFamily = multipleMarker.fontFamily;
					if(multipleMarker.fontStyle) multipleMarkerOptions.fontStyle = multipleMarker.fontStyle;
					if(multipleMarker.fontWeight) multipleMarkerOptions.fontWeight = multipleMarker.fontWeight;
					if(multipleMarker.textColor) multipleMarkerOptions.textColor = multipleMarker.textColor;
					if(multipleMarker.textDecoration) multipleMarkerOptions.textDecoration = multipleMarker.textDecoration;
					if(multipleMarker.textSize) multipleMarkerOptions.textSize = multipleMarker.textSize;

					markerCluster.setStyles([
						multipleMarkerOptions
					]);
				}
			} else {
				for (var i = 0; i < markers.length; i++) {
					markers[i].setMap($this.set.map);
				}
			}

		},
		logPosition: function() {
			var $this = this;

			$this.set.center = $this.set.map.getCenter();
			$this.set.zoom = $this.set.map.getZoom();
		},
		moveToMarker: function(location, callback) {
			//Show specific marker on map.
			var $this = this,
				latLng,
				currentMarker = $this.set.mapData.locations[location];

			callback = callback || function() {};

			if(currentMarker.latitude === '' || currentMarker.longitude === '') {
				if($this.set.debug) console.log('This location has no coordinates.');
				return callback({'success': false});
			}
			latLng = new google.maps.LatLng(currentMarker.latitude, currentMarker.longitude);

			$this.set.map.setCenter(latLng);
			$this.set.map.setZoom($this.set.zoomedIn);
			return callback({'success': true});
		},
		moveToCoords: function(coords) {
			//Show specific area on map.
			var $this = this,
				latLng;

			coords.callback = coords.callback || function() {};

			if(!coords.lat || !coords.lng || !coords.zoom) {
				if($this.set.debug) console.log('Coordinates need all the values. Latitude, longitude and zoom lat:' + coords.lat + ' lng: ' + coords.lng + ' zoom: ' + coords.zoom);
				return coords.callback({success: false});
			}

			latLng = new google.maps.LatLng(coords.lat, coords.lng);
			$this.set.map.setCenter(latLng);
			$this.set.map.setZoom(coords.zoom);
			return coords.callback({success: true});
		},
		getLocation: function(callback) {
			var myPosition,
				marker;

			if(navigator.geolocation) {
				navigator.geolocation.getCurrentPosition(function(position) {
					
					myPosition = {lat: position.coords.latitude, lng: position.coords.longitude};
					if(typeof callback === 'function') return callback(myPosition);

				}, function() {
					handleNoGeolocation(true);
				});
			} else {
				// Browser doesn't support Geolocation
				handleNoGeolocation(false);
			}

		},
		withinBounds: function(sw, ne, locations) {
			//Returns if marker is found within bounds given. 
			//Requires: sw:{lat:(int),lng(int)}, ne:{lat:(int),lng:(int)}, marker object
			// +  ne
			// sw  +

			var inBounds = false,
				markerData,
				inLat,
				position;

			for(markerData in locations) {
				inLat = false;
				position = locations[markerData];
				
				if(position.latitude > sw.lat && position.latitude < ne.lat) inLat = true;
				if(inLat) {
					if(position.longitude > sw.lng && position.longitude < ne.lng) {
						inBounds = true;
						break;
					}
				}
			}

			return inBounds;
		},
		findNearest: function(myPosition, locations) {
			//Use this perhaps to expand bounds, nearby countries.
			var $this = this,
				markerData,
				distance,
				storeLocation,
				bounds,
				closest = [],
				counter = 0;

			for(markerData in locations) {
				storeLocation = {lat: locations[markerData].latitude, lng: locations[markerData].longitude};

				closest[counter] = {
					id: markerData,
					distance: priv.haversine(myPosition, storeLocation),
					data: locations[markerData]
				};
				counter++;
			}
			
			//Order stores in ascending order of closest to furtherst away.
			closest.sort(function(a, b) {
				return a.distance - b.distance;
			});

			return closest;

		},
		radians: function(x) {
			return x * Math.PI / 180;
		},
		haversine: function(p1, p2) {
			//Distance between two geolocations in km.
			var R = 6371,
				dLat  = priv.radians(p2.lat - p1.lat),
				dLng = priv.radians(p2.lng - p1.lng),
				a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(priv.radians(p1.lat)) * Math.cos(priv.radians(p2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2),
				c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
				d = R * c;

			return Math.round(d);
		}
	};

	var methods = {
		init: function(options) {

			return this.each(function() {
				
				var $this = $(this),
					objectData = $this.data();

				$this.set = $.extend({}, defaultOpts, options, objectData, privateOpts);

				priv.init.apply($this);
				$this.data($this.set);

			});
		},
		showOnMap: function(options) {

			return this.each(function() {
				var $this = $(this),
					objectData = $this.data();

				$this.set = $.extend({}, $this.data());
				priv.moveToMarker.apply($this, [options.id, options.callback]);
				$this.data($this.set);

			});
		},
		showCoords: function(options) {

			return this.each(function() {
				var $this = $(this),
					objectData = $this.data();

				$this.set = $.extend({}, $this.data());
				priv.moveToCoords.apply($this, [options]);
				$this.data($this.set);

			});	

		},
		update: function(options) {
			
			return this.each(function() {
				var $this = $(this);

				$this.set = $.extend({}, $this.data(), options);
				priv.update.apply($this);

				$this.data($this.set);
			});

		},
		destroy: function(options) {

			return this.each(function() {
				var $this = $(this);

				$this.set = $.extend({}, $this.data(), options, privateOpts);

			});
		}
	};

	var defaultOpts	= {
		debug: false,
		mapsURL: '//maps.google.com/maps/api/js',
		urlParams: {},
		defaultCountry: false,
		mapData: 'map-data.json',
		mapOptions: {},
		multipleMarker: false,
		singleMarker: false,
		personMarker: false,
		zoomedIn: 14,
		strokeColor: '#000000'
	};

	var privateOpts = {
		center: undefined,
		current: {
			infoWindow: undefined,
			position: undefined,
			nearestStore: undefined,
			crowFlies: undefined
		}
	};

	$.fn.reppam = function(method) {

		//arguments local variable to all functions.
		if (methods[method]) {
			//If explicitly calling a method.
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else if (typeof method === 'object' || !method) {
			//If method is an "object" (can also be an array) or no arguments passed to the function.
			return methods.init.apply(this, arguments);
		} else {
			$.error('Method ' +  method + ' does not exist on jQuery.reppam');
		}

	};

})(jQuery, window);