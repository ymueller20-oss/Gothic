# Letztes Licht

Ein düsteres 3D-Rollenspiel für Android, gebaut fürs Hochformat.
Eigene Welt, eigene Geschichte, eigene Figuren.

Kaltenbruch liegt seit neun Jahren im Nebel. Nur Licht hält die Fahlen fern.
Du spielst Wendel, den Lehrling des Lampenträgers Ambros. Ambros ist von seiner
nächtlichen Runde nicht zurückgekehrt.

## Was drin ist (Kapitel 1)

- Frei begehbare Stadt: Hafen, Markt, Gasthaus, Gildenkontor, Lagerhaus, Wachstube, Friedhof, Südufer, Turm
- 10 Figuren mit Dialogen und Entscheidungen, die das Ende verändern
- 3 Quests: „Die letzte Runde" (Hauptgeschichte), „Ein Stein für Matthis", „Beschlagnahmt"
- Licht als Spielmechanik: Die Laterne verbraucht Öl. Reines und gestrecktes Öl wirken unterschiedlich. Straßenlampen vertreiben die Fahlen.
- Kampf, Erfahrung, Stufen, Lernpunkte, Lehrer (Stärke, Geschick)
- Inventar, Tagebuch, automatisches Speichern
- 3D mit Third-Person-Kamera (three.js): echte Texturen und Modelle (Poly Haven, CC0), Fachwerkhäuser, Laternenlicht mit Lichthöfen, Nebel, Regen, Klangkulisse
- Kamera drehen: auf der Spielwelt wischen. Grafikqualität im Menü umschaltbar
- Touch-Steuerung im unteren Bildschirmdrittel, die Spielwelt füllt den Rest des Hochformats

## Auf dem Handy spielen

Das Spiel ist eine installierbare Web-App (PWA) ohne Abhängigkeiten.

1. Den Ordner auf einen beliebigen Webserver legen (z. B. GitHub Pages).
2. Die Seite in Chrome auf Android öffnen.
3. Menü → „Zum Startbildschirm hinzufügen". Danach startet es im Vollbild und funktioniert offline.

Lokal testen:

```
npx http-server -p 8123 .
```

## Als APK bauen (optional)

Mit Capacitor lässt sich derselbe Code als Android-App verpacken. Dafür wird das Android SDK benötigt:

```
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Letztes Licht" de.letzteslicht.app --web-dir .
npx cap add android
npx cap sync
npx cap open android   # in Android Studio bauen
```

## Tests

`tests/smoke.mjs` spielt die Hauptgeschichte im Handy-Hochformat automatisch durch und meldet JavaScript-Fehler.
Dafür muss ein Server auf Port 8123 laufen.

## Steuerung

| Handy | Tastatur | Aktion |
|---|---|---|
| linker Kreis | WASD / Pfeile | gehen |
| Schlag (halten) | Leertaste | angreifen |
| Benutzen | E | sprechen, anzünden, aufheben |
| ✒ ⚱ ☗ ☰ | J I C Esc | Tagebuch, Inventar, Charakter, Menü |
