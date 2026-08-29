/**
 * StylizedMap.tsx
 * ---------------
 * Interactive Real-Time Map with live user GPS tracking and nearby EV stations.
 * Powered by Leaflet + OpenStreetMap / CartoDB tiles with zero API keys required.
 * Styled to perfectly match the mint-teal Ride-For-You theme.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontFamily, radius, shadows } from '../theme';

export type MapStation = {
  id: string;
  lat?: number;
  lng?: number;
  /** Relative offset or coordinate */
  x?: number;
  y?: number;
  available: number;
  name?: string;
};

type StylizedMapProps = {
  width: number;
  height: number;
  stations?: MapStation[];
  onLocationChange?: (locationName: string) => void;
};

// Default fallback coordinates (e.g. Bangalore tech hub / India)
const DEFAULT_COORDS = {
  latitude: 12.9716,
  longitude: 77.5946,
};

export function StylizedMap({ width: w, height: h, stations: customStations, onLocationChange }: StylizedMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function getUserLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setPermissionDenied(true);
            setCoords(DEFAULT_COORDS);
            setLoading(false);
          }
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (isMounted) {
          const userLat = loc.coords.latitude;
          const userLng = loc.coords.longitude;
          setCoords({ latitude: userLat, longitude: userLng });
          setLoading(false);

          // Reverse geocode to get a clean neighborhood/city name
          Location.reverseGeocodeAsync({ latitude: userLat, longitude: userLng })
            .then((places) => {
              if (places && places.length > 0 && isMounted) {
                const p = places[0];
                const cleanName = [p.name || p.street, p.district || p.subregion || p.city]
                  .filter(Boolean)
                  .join(', ');
                if (cleanName) {
                  onLocationChange?.(cleanName);
                }
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        if (isMounted) {
          setCoords(DEFAULT_COORDS);
          setLoading(false);
        }
      }
    }

    getUserLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeCoords = coords || DEFAULT_COORDS;

  // Calculate station points around the active coordinates
  const stationsToRender = (customStations && customStations.length > 0)
    ? customStations.map((s, idx) => {
        const offsets = [
          { lat: 0.0032, lng: -0.0041, name: 'Metro Station Hub' },
          { lat: -0.0028, lng: 0.0035, name: 'Tech Park EV Point' },
          { lat: 0.0045, lng: 0.0029, name: 'City Center Hub' },
        ];
        const offset = offsets[idx % offsets.length];
        return {
          id: s.id,
          lat: s.lat ?? (activeCoords.latitude + offset.lat),
          lng: s.lng ?? (activeCoords.longitude + offset.lng),
          available: s.available,
          name: s.name || offset.name,
        };
      })
    : [
        { id: 's1', lat: activeCoords.latitude + 0.0032, lng: activeCoords.longitude - 0.0041, available: 12, name: 'Station A' },
        { id: 's2', lat: activeCoords.latitude - 0.0028, lng: activeCoords.longitude + 0.0035, available: 8, name: 'Station B' },
        { id: 's3', lat: activeCoords.latitude + 0.0045, lng: activeCoords.longitude + 0.0029, available: 5, name: 'Station C' },
      ];

  const handleRecenter = () => {
    if (coords && webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.map) {
          window.map.flyTo([${coords.latitude}, ${coords.longitude}], 15, { animate: true, duration: 1.2 });
        }
        true;
      `);
    }
  };

  const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #eef2ef;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* Clean Carto Positron with soft mint-teal tint */
    .leaflet-tile-pane {
      filter: saturate(1.15) hue-rotate(-5deg) contrast(0.98);
    }
    
    /* Pulse user location pin */
    .user-marker {
      position: relative;
      width: 24px;
      height: 24px;
    }
    .user-dot {
      width: 16px;
      height: 16px;
      background: #2563EB;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      position: absolute;
      top: 4px;
      left: 4px;
      box-shadow: 0 2px 6px rgba(37,99,235,0.4);
      z-index: 2;
    }
    .user-pulse {
      width: 32px;
      height: 32px;
      background: rgba(37,99,235,0.22);
      border-radius: 50%;
      position: absolute;
      top: -4px;
      left: -4px;
      animation: pulse 2s infinite ease-out;
      z-index: 1;
    }
    @keyframes pulse {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    
    /* Station Badge Pin */
    .station-badge {
      display: inline-flex;
      align-items: center;
      background: #FFFFFF;
      border-radius: 20px;
      padding: 3px 8px 3px 3px;
      box-shadow: 0 4px 12px rgba(10,40,30,0.16);
      cursor: pointer;
      white-space: nowrap;
      transition: transform 0.15s ease;
    }
    .station-badge:active {
      transform: scale(0.95);
    }
    .station-icon {
      width: 26px;
      height: 26px;
      border-radius: 13px;
      background: #14B8A6;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: bold;
      margin-right: 5px;
      box-shadow: 0 2px 4px rgba(20,184,166,0.3);
    }
    .station-text {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
      padding-right: 2px;
    }
    .station-count {
      font-size: 11px;
      font-weight: 700;
      color: #0F172A;
    }
    .station-sub {
      font-size: 8.5px;
      font-weight: 500;
      color: #64748B;
    }

    /* Hide Leaflet default attribution for clean UI */
    .leaflet-control-attribution {
      display: none !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [${activeCoords.latitude}, ${activeCoords.longitude}],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });
    window.map = map;

    // Use fast, clean CartoDB light tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Add User location marker with pulsing ripple
    var userIcon = L.divIcon({
      className: 'custom-user-icon',
      html: '<div class="user-marker"><div class="user-pulse"></div><div class="user-dot"></div></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    L.marker([${activeCoords.latitude}, ${activeCoords.longitude}], { icon: userIcon }).addTo(map);

    // Add Station markers
    var stations = ${JSON.stringify(stationsToRender)};
    stations.forEach(function(s) {
      var icon = L.divIcon({
        className: 'custom-station-icon',
        html: '<div class="station-badge"><div class="station-icon">&#9889;</div><div class="station-text"><span class="station-count">' + s.available + '</span><span class="station-sub">Available</span></div></div>',
        iconSize: [80, 32],
        iconAnchor: [40, 16]
      });
      L.marker([s.lat, s.lng], { icon: icon }).addTo(map);
    });
  </script>
</body>
</html>
`;

  return (
    <View style={[styles.wrap, { width: w, height: h }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.brand.primary} />
          <Text style={styles.loadingText}>Locating nearest EV stations...</Text>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.webView}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          nestedScrollEnabled={true}
        />
      )}

      {/* Re-center GPS button */}
      <Pressable style={styles.recenterBtn} onPress={handleRecenter}>
        <Ionicons name="locate" size={19} color={colors.brand.primary} />
      </Pressable>

      {permissionDenied && (
        <View style={styles.permissionBadge}>
          <Text style={styles.permissionText}>Showing default area (GPS off)</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#EEF2EF',
  },
  webView: {
    flex: 1,
    backgroundColor: '#EEF2EF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: colors.text.secondary,
  },
  recenterBtn: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
    zIndex: 10,
  },
  permissionBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    ...shadows.subtle,
  },
  permissionText: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: colors.text.secondary,
  },
});
