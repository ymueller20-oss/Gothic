// Geschichte, Figuren, Gegenstände und Dialoge von „Letztes Licht".
// Zeilen mit „@" spricht Wendel, Zeilen mit „*" sind Erzählung.

export const PLAYER_NAME = 'Wendel';

export const INTRO = [
  'Neun Jahre ist es her, dass die Sonne über Kaltenbruch zum letzten Mal ganz aufging.',
  'Seitdem steigt Nebel aus dem Schwarzsee. Mit dem Nebel kommen die Fahlen.',
  'Nur Licht hält sie fern. Deshalb gibt es Lampenträger.',
  'Meister Ambros ist letzte Nacht zu seiner Runde aufgebrochen.',
  'Er ist nicht zurückgekommen.',
];

export const ITEMS = {
  oel_rein: { name: 'Reines Lampenöl', desc: 'Klar wie Bernstein. Riecht nach Harz.', use: 'fill', oil: 60 },
  oel_trueb: { name: 'Gestrecktes Öl', desc: 'Milchig. Mit dem Siegel der Trangilde.', use: 'fill', oil: 25 },
  suppe: { name: 'Fischsuppe', desc: 'Mehr Wasser als Fisch. Aber heiß.', use: 'heal', heal: 25 },
  brot: { name: 'Schwarzbrot', desc: 'Hart genug, um damit zu kämpfen.', use: 'heal', heal: 10 },
  haken: { name: 'Lampenhaken', desc: 'Eisenstange mit Haken. Schaden 4.', weapon: 4 },
  saebel: { name: 'Wachsäbel', desc: 'Schartig, aber ehrlich. Schaden 8.', weapon: 8 },
  notizbuch: { name: 'Ambros\' Notizbuch', desc: 'Abgegriffen, voller Zahlen.', use: 'read' },
  schluessel_friedhof: { name: 'Friedhofsschlüssel', desc: 'Rostig. Von Fink.' },
  schluessel_turm: { name: 'Turmschlüssel', desc: 'Schwer und kalt, mit Ambros\' Zeichen.' },
  kiste: { name: 'Versiegelte Kiste', desc: 'Gildensiegel. Darin klirren Flaschen.' },
  medaillon: { name: 'Matthis\' Medaillon', desc: 'Zinn, angelaufen. Innen ein eingeritztes „H".' },
  fahlstaub: { name: 'Fahlstaub', desc: 'Kalte Asche, die nicht zu Boden fallen will.' },
};

export const NOTEBOOK = `Tag 3212 der Dämmerung.
Lampe Markt: 4 Std. Lampe Hafen: 3½ Std. Friedhofsweg: 3 Std.
Vor einem Jahr waren es sechs.

Die Gilde sagt, es liegt an der Kälte. Kälte macht Öl nicht milchig.

Habe eine Probe abgekocht. Am Boden graue Asche, die nicht sinken will. Fahlstaub?

Wendel weiß nichts davon. Gut so. Der Junge soll schlafen können.

Heute Nacht: Hedda. Dann die Runde – Markt, Hafen, Friedhofsweg.
Dann zu den Stillen am Ufer. Ich will wissen, warum sie lächeln.`;

export const QUESTS = {
  runde: 'Die letzte Runde',
  matthis: 'Ein Stein für Matthis',
  kiste: 'Beschlagnahmt',
};

// Lampen: quest = gehört zu Ambros' Runde (anfangs aus)
export const LAMPS = [
  { id: 'markt', x: 21, y: 26, quest: true, name: 'Lampe am Markt' },
  { id: 'hafen', x: 12, y: 31, quest: true, name: 'Lampe am Hafen' },
  { id: 'friedhof', x: 25, y: 47, quest: true, name: 'Lampe am Friedhofsweg' },
  { id: 'gasthaus', x: 37, y: 22, lit: true },
  { id: 'wache', x: 49, y: 29, lit: true },
  { id: 'werkstatt', x: 25, y: 40, lit: true },
  { id: 'kontor', x: 20, y: 20, lit: true },
  { id: 'marktsued', x: 36, y: 34, lit: true },
];

// Feste Lichtquellen in Innenräumen
export const GLOWS = [
  { x: 32, y: 14, r: 64, c: [255, 140, 60] },   // Herdfeuer im Gasthaus
  { x: 18, y: 13, r: 44, c: [255, 190, 110] },  // Kontor
  { x: 46, y: 23, r: 48, c: [255, 160, 80] },   // Wachstube
  { x: 32, y: 42, r: 40, c: [255, 170, 90] },   // Werkstatt
  { x: 3, y: 28, r: 40, c: [255, 170, 90] },    // Lenes Laterne
  { x: 31, y: 51, r: 30, c: [220, 150, 90] },   // Finks Kerze
];

export const OBJECTS = [
  { id: 'desk', x: 31, y: 41, label: 'Untersuchen' },
  { id: 'shelf', x: 34, y: 44, label: 'Nehmen' },
  { id: 'bed', x: 34, y: 41, label: 'Schlafen' },
  { id: 'gate', x: 27, y: 52, label: 'Tor' },
  { id: 'crate', x: 14, y: 40, label: 'Nehmen' },
  { id: 'sabre', x: 20, y: 44, label: 'Nehmen' },
  { id: 'tower', x: 47, y: 7, label: 'Turm' },
];

const look = (o) => ({ skin: '#c9a487', ...o });

export const NPCS = [
  { id: 'hedda', name: 'Hedda', x: 34, y: 15, look: look({ cloak: '#5a3a2e', hair: '#6b6258', long: true, belt: '#c9bba0' }),
    barks: ['Wischt euch die Stiefel ab.', 'Suppe ist heiß. Mehr verspreche ich nicht.', 'Noch einer, der nicht reden will.'] },
  { id: 'kassian', name: 'Kassian Vell', x: 18, y: 14, look: look({ cloak: '#2b2f3a', hair: '#1e1b18', belt: '#a08a4a', trim: '#a08a4a' }),
    barks: ['Zahlen lügen nicht. Menschen schon.', 'Alles hat seinen Preis.'] },
  { id: 'lene', name: 'Lene', x: 3, y: 28, look: look({ cloak: '#2f3b32', hood: '#25302a', skin: '#d0ab8c' }),
    barks: ['Guck nicht so.', 'Das Wasser ist heute unruhig.', 'Wenn du nichts kaufst, geh.'] },
  { id: 'reutter', name: 'Hauptmann Reutter', x: 46, y: 24, look: look({ cloak: '#4a4038', hair: '#888078', beard: '#7a726a', belt: '#2a2520' }),
    barks: ['Sechs Mann. Für eine ganze Stadt.', 'Wo bleibt die Ablösung ...'] },
  { id: 'fink', name: 'Fink', x: 30, y: 51, look: look({ cloak: '#2a2622', hood: '#1f1c19', beard: '#555048' }),
    barks: ['Die Toten beschweren sich nie.', 'Schaufel, Erde, Schaufel, Erde.', 'Noch nicht, Junge. Noch nicht.'] },
  { id: 'zaehler', name: 'Der Zähler', x: 30, y: 27, look: look({ cloak: '#3a3630', hair: '#9a948a', beard: '#9a948a' }),
    barks: ['Sieben. Acht. Nein, sieben.', 'Einer weniger als gestern.', 'Zählen. Einer muss zählen.'] },
  { id: 'ulm', name: 'Fischer Ulm', x: 10, y: 22, look: look({ cloak: '#3a4048', hood: '#2e333a', beard: '#5a524a' }),
    barks: ['Leer. Wieder leer.', 'Hörst du das? Nein? Gut.'] },
  { id: 'borg', name: 'Wächter Borg', x: 24, y: 31, look: look({ cloak: '#4a4038', hair: '#3a2a20', belt: '#2a2520' }),
    barks: ['Weitergehen.', 'Hier gibt\'s nichts zu sehen.', 'Verdammter Nebel.'] },
  { id: 'ohm', name: 'Bruder Ohm', x: 34, y: 65, look: look({ cloak: '#8a8c88', hood: '#7a7c78', skin: '#b8b4ac', eyes: '#6a6e70' }),
    barks: ['Hmmmm ...', 'Still. Ganz still.', 'Das Wasser wartet. Es hat Zeit.'] },
  { id: 'ambros', name: 'Ambros', x: 30, y: 66, look: look({ cloak: '#4a3a28', hair: '#b0aaa0', beard: '#b0aaa0', belt: '#6a5a32', skin: '#aeb2b0' }),
    barks: ['Wendel ... das ist dein Name. Und meiner ist ...', 'Kalt. So kalt.'] },
];

export const ENEMIES = [
  { id: 'r1', type: 'rat', x: 14, y: 44 }, { id: 'r2', type: 'rat', x: 18, y: 40 },
  { id: 'r3', type: 'rat', x: 20, y: 45 }, { id: 'r4', type: 'rat', x: 16, y: 42 },
  { id: 'p1', type: 'pale', x: 20, y: 56 }, { id: 'p2', type: 'pale', x: 35, y: 58 },
  { id: 'p3', type: 'pale', x: 23, y: 61 }, { id: 'p4', type: 'pale', x: 38, y: 55 },
  { id: 'p5', type: 'pale', x: 47, y: 65 }, { id: 'p6', type: 'pale', x: 13, y: 65 },
];

// ---------------------------------------------------------------- Hilfen

const once = (g, key) => !g.f('said_' + key);
const said = (key) => (g) => g.set('said_' + key);
const all = (...fns) => (g) => fns.forEach((fn) => fn(g));

// Lehrer: 1 Lernpunkt (+ Münzen) pro Stufe
const teach = (stat, label, cost, max) => ({
  t: (g) => `${label} +1 (1 LP${cost ? `, ${cost} Münzen` : ''}) – jetzt ${g.s.player[stat]}`,
  if: (g) => g.s.player[stat] < max,
  need: (g) => g.s.player.lp >= 1 && g.s.player.coins >= cost,
  do: (g) => { g.s.player.lp -= 1; g.coins(-cost); g.s.player[stat] += 1; g.toast(`${label} steigt auf ${g.s.player[stat]}.`); },
  go: 'teach',
});

const buy = (item, price) => ({
  t: () => `${item === 'oel_trueb' ? 'Gestrecktes Öl' : item === 'oel_rein' ? 'Reines Öl' : item === 'suppe' ? 'Fischsuppe' : 'Schwarzbrot'} kaufen (${price} Münzen)`,
  need: (g) => g.s.player.coins >= price,
  do: (g) => { g.coins(-price); g.give(item); },
  go: 'shop',
});

// ---------------------------------------------------------------- Dialoge

export const DIALOGS = {
  // ------------------------------------------------------------ Hedda
  hedda: {
    start: (g) => (g.f('hedda_met') ? 'hub' : 'first'),
    nodes: {
      first: {
        say: [
          'Na sieh an. Der Lehrling. Mach die Tür zu, sonst kriecht der Nebel unter die Tische.',
          '@Hedda. Meister Ambros ist nicht nach Hause gekommen.',
          '...',
          'Nein. Ist er nicht, was?',
          'Er saß gestern hier. Da drüben, wo das Holz schwarz ist. Hat seinen Krug nicht angerührt. Das allein hätte mich stutzig machen sollen.',
        ],
        choices: [{ t: 'Was hat er gesagt?', go: 'ambros' }],
      },
      ambros: {
        say: [
          'Dass das Öl faul ist. „Alles, Hedda", hat er gesagt. „Auch das im Turm."',
          'Dann hat er drei Flaschen eingepackt und ist raus.',
          'Ich hab vom Fenster aus zugesehen. Die Lampe am Markt ging an, dann die am Hafen, dann die am Friedhofsweg. Wie jede Nacht.',
          'Und eine Stunde später gingen sie wieder aus. Eine nach der anderen. In derselben Reihenfolge.',
          '@Lampen gehen nicht von allein aus.',
          'Nein. Tun sie nicht. Und deshalb redet in dieser Stadt auch keiner darüber.',
        ],
        do: (g) => {
          g.set('hedda_met');
          g.log('runde', 'Hedda sah, wie die drei Lampen auf Ambros\' Runde erloschen: am Markt, am Hafen und am Friedhofsweg. Wenn ich ihm folgen will, muss ich sie wieder anzünden. Jede Lampe braucht eine Flasche Öl.');
        },
        go: 'hub',
      },
      hub: {
        say: (g) => [g.pick([
          'Noch was? Ich hab nicht ewig Zeit. Doch, eigentlich hab ich das. Das ist ja das Elend.',
          'Was brauchst du, Junge?',
          'Setz dich oder geh. Herumstehen macht die Gäste nervös. Welche Gäste, fragst du? Eben.',
        ])],
        choices: [
          { t: 'Was weißt du über das Öl?', if: (g) => once(g, 'h_oil'), go: 'oil' },
          { t: 'Du siehst traurig aus.', if: (g) => !g.f('matthis_got'), go: 'matthis' },
          { t: 'Ich war unten am Wasser. Ich weiß, was mit Matthis passiert ist.', if: (g) => g.has('medaillon') && !g.f('matthis_done'), go: 'truth' },
          { t: 'Ich hab Hunger.', go: 'shop' },
          { t: 'Ich muss los.', go: null },
        ],
      },
      oil: {
        say: [
          'Die Gilde liefert. Kassian Vell bestimmt den Preis, und Kassian Vell bestimmt, was drin ist.',
          'Seit dem zweiten Winter brennen meine Lampen kürzer. Ich hab\'s auf die Kälte geschoben. Man schiebt hier vieles auf die Kälte.',
          'Wenn du sauberes Öl willst, frag am Hafen nach Lene. Aber sag nicht, dass du\'s von mir hast.',
        ],
        do: said('h_oil'),
        go: 'hub',
      },
      matthis: {
        say: [
          'Traurig. Hm. Das Wort hab ich lange nicht gehört. Hier sagt man „müde".',
          'Mein Junge, Matthis. Vor zwei Wintern ist er abends raus, Netze flicken. Der Nebel kam früh in dem Jahr.',
          'Kein Leichnam. Keine Spur. Fink sagt, ohne Leichnam kein Grab. Ein Stein kostet extra.',
          'Ich hab nie die Zeit gefunden, zu ihm zu gehen.',
          '...',
          'Das ist gelogen. Ich hab nie den Mut gefunden.',
        ],
        choices: [
          { t: 'Ich rede mit Fink. Matthis bekommt seinen Stein.', go: 'thanks',
            do: (g) => { g.set('matthis_got'); g.log('matthis', 'Hedda wünscht sich einen Grabstein für ihren Sohn Matthis, der vor zwei Wintern im Nebel verschwand. Fink, der Totengräber, verlangt Geld dafür.'); } },
          { t: 'Das ist nicht meine Sache.', go: 'notmine' },
        ],
      },
      thanks: { say: ['Du bist ein guter Junge, Wendel. Ambros hat das immer gesagt.', 'Ich hab\'s ihm nie geglaubt.'] },
      notmine: { say: ['Nein. Ist es nicht.', 'Entschuldige. Die Nacht macht einen geschwätzig.'] },
      truth: {
        say: [
          'Sag es mir.',
          'Nein, warte. Gib mir einen Moment.',
          '*Hedda wischt über den Tresen, an einer Stelle, die längst sauber ist.',
          'Jetzt.',
        ],
        choices: [
          { t: 'Er ist ins Wasser gegangen. Freiwillig. Er hat dabei gesungen.', go: 'truth_real' },
          { t: 'Er hat gegen den Nebel gekämpft. Bis zum Schluss.', go: 'truth_lie' },
        ],
      },
      truth_real: {
        say: [
          'Gesungen.',
          'Er konnte nie singen. Hat immer falsch gesungen, laut und falsch, und hat dabei gelacht.',
          'Dann war er wenigstens nicht allein. Dann hatte er wenigstens keine Angst.',
          '*Sie nimmt das Medaillon und schließt die Faust darum.',
          'Danke, Wendel. Es tut weh. Aber es ist meins.',
        ],
        do: (g) => { g.take('medaillon'); g.set('matthis_done'); g.set('matthis_truth'); g.give('suppe', 2); g.xp(40); g.log('matthis', 'Ich habe Hedda die Wahrheit gesagt. Sie hat geweint und mir zwei Schüsseln Suppe gegeben.', 'done'); },
      },
      truth_lie: {
        say: [
          'Ja? Ja. Das sieht ihm ähnlich. Stur wie sein Vater.',
          '*Sie nimmt das Medaillon und schaut dich lange an.',
          'Du bist ein schlechter Lügner, Junge. Aber ein freundlicher.',
          'Behalt das, das Freundliche. Davon gibt\'s hier zu wenig.',
        ],
        do: (g) => { g.take('medaillon'); g.set('matthis_done'); g.give('suppe', 2); g.xp(40); g.log('matthis', 'Ich habe Hedda erzählt, Matthis habe gekämpft. Ich glaube, sie wusste, dass es nicht stimmt.', 'done'); },
      },
      shop: {
        say: ['Suppe gibt\'s immer. Brot, solange es reicht.'],
        choices: [buy('suppe', 5), buy('brot', 2), { t: 'Nichts mehr.', go: 'hub' }],
      },
    },
  },

  // ------------------------------------------------------------ Fink
  fink: {
    start: (g) => (g.f('fink_met') ? 'hub' : 'first'),
    nodes: {
      first: {
        say: [
          'Halt. Wenn du zu einem Toten willst: Die liegen alle drinnen und laufen nicht weg. Wenn du zu einem Lebenden willst: falsche Adresse.',
          '@Ich bin Wendel. Ambros\' Lehrling.',
          'Ach. Der Lampenjunge. Dein Meister kam gestern Nacht hier vorbei. Wollte durchs Tor, runter ans Wasser.',
          'Ich hab ihn durchgelassen. Das bereue ich.',
          'Dich lass ich nicht durch.',
        ],
        do: (g) => g.set('fink_met'),
        go: 'hub',
      },
      hub: {
        say: (g) => [g.pick(['Was noch?', 'Sprich, Junge. Die Erde wird nicht wärmer.', 'Hm?'])],
        choices: [
          { t: 'Lass mich durch. Ich muss Ambros finden.', if: (g) => !g.has('schluessel_friedhof') && !g.f('gate_open'), go: (g) => (g.questLampsLit() >= 3 ? 'key' : 'nokey') },
          { t: 'Hedda möchte einen Stein für Matthis.', if: (g) => g.f('matthis_got') && once(g, 'f_matthis'), go: 'matthis' },
          { t: 'Hier sind zehn Münzen für Matthis\' Stein.', if: (g) => g.f('said_f_matthis') && !g.f('stone_paid'), need: (g) => g.s.player.coins >= 10, go: 'paid',
            do: (g) => { g.coins(-10); g.set('stone_paid'); } },
          { t: 'Wie lange machst du das schon?', if: (g) => once(g, 'f_job'), go: 'job' },
          { t: 'Leb wohl.', go: null },
        ],
      },
      nokey: {
        say: [
          'Der Weg hier ist dunkel, weil deine Lampen dunkel sind.',
          'Mach erst deine Runde fertig, so wie dein Meister. Drei Lichter. Dann reden wir.',
          'Ich schick keinen Jungen in den Nebel, der nicht mal mit einer Laterne umgehen kann.',
        ],
      },
      key: {
        say: [
          'Drei Lichter. Ich hab sie gesehen, von hier aus. Hast du gut gemacht.',
          'Ambros sagt immer: Wer die Runde zu Ende geht, darf auch ans Ende sehen.',
          'Hier. Der Schlüssel.',
          'Und Junge: Hinter den Gräbern ist es dunkler, als es aussieht. Die Toten liegen still. Das andere nicht.',
        ],
        do: (g) => { g.give('schluessel_friedhof'); g.log('runde', 'Fink hat mir den Friedhofsschlüssel gegeben. Ambros ist hinter dem Friedhof zum Ufer gegangen.'); },
      },
      matthis: {
        say: [
          'Matthis. Hm. Der Lauteste von allen Lauten.',
          'Ohne Leichnam kein Grab, so ist das Gesetz. Aber einen Stein kann ich setzen. Zehn Münzen. Stein ist teuer, seit keiner mehr aus dem Steinbruch zurückkommt.',
          'Und noch was. Ich hab ihn gehört, damals. Unten am Ufer, hinter dem Friedhof. Er hat gesungen. Die Stillen singen alle, wenn sie gehen.',
          'Wenn du die Wahrheit willst, frag Bruder Ohm am Wasser. Aber pass auf, dass du nicht mitsingst.',
        ],
        do: all(said('f_matthis'), (g) => g.log('matthis', 'Fink glaubt, Matthis sei zu den Stillen ans Ufer gegangen. Bruder Ohm soll mehr wissen. Für zehn Münzen setzt Fink einen Stein.')),
        go: 'hub',
      },
      paid: {
        say: ['Ich setz ihn morgen. Mit Namen.', 'Und ich schreib „geliebt" drauf. Das kostet nichts extra.'],
        do: (g) => g.log('matthis', 'Ich habe Fink bezahlt. Matthis bekommt seinen Stein.'),
        go: 'hub',
      },
      job: {
        say: [
          'Gräber? Seit ich laufen kann. Mein Vater hat gegraben, sein Vater auch.',
          'Früher hab ich die Toten gezählt. Jetzt zähl ich die, die noch nicht tot sind.',
          'Geht schneller.',
        ],
        do: said('f_job'),
        go: 'hub',
      },
    },
  },

  // ------------------------------------------------------------ Kassian
  kassian: {
    start: (g) => (g.f('kassian_met') ? 'hub' : 'first'),
    nodes: {
      first: {
        say: [
          'Wendel, nicht wahr? Ambros\' Lehrling. Setz dich.',
          'Nein? Auch gut. Stehen hält warm.',
          'Ich hörte, dein Meister ist ... unpässlich. Bedauerlich. Ein fähiger Mann. Etwas zu misstrauisch für sein Alter.',
        ],
        do: (g) => g.set('kassian_met'),
        go: 'hub',
      },
      hub: {
        say: (g) => [g.pick(['Nun?', 'Zeit ist Öl, Junge.', 'Ich höre.'])],
        choices: [
          { t: 'Ambros sagt, euer Öl ist gestreckt.', if: (g) => g.f('hedda_met') && once(g, 'k_oil'), go: 'oil' },
          { t: 'Wozu kauft ihr Fahlstaub?', if: (g) => g.f('seen_dust') && once(g, 'k_dust'), go: 'dust' },
          { t: 'Ich brauche Öl.', go: 'shop' },
          { t: 'Ich habe eure Kiste aus dem Lagerhaus.', if: (g) => g.has('kiste'), go: 'crate' },
          { t: 'Ich gehe.', go: null },
        ],
      },
      oil: {
        say: [
          'Sagt er das? Sagt er das noch, oder sagte er das?',
          '@Was soll das heißen?',
          'Nur eine Frage der Grammatik, Junge.',
          'Unser Öl ist so gut wie die Zeiten. Die Zeiten sind schlecht. Wer mehr will, soll mehr zahlen.',
          'Und wer Lügen über die Gilde erzählt, sollte bedenken, wer die Lampen füllt, unter denen er schläft.',
        ],
        do: said('k_oil'),
        go: 'hub',
      },
      dust: {
        say: [
          'Neugierig. Das ist eine teure Eigenschaft.',
          'Man streut ihn ins Öl. Er nimmt die Farbe weg. Niemand kauft graues Öl.',
          '@Ambros schreibt, dass das Öl davon schwächer brennt.',
          'Ambros schreibt vieles. Papier ist geduldig. Ich bin es nicht.',
        ],
        do: all(said('k_dust'), (g) => g.log('runde', 'Kassian gibt zu, dass die Gilde Fahlstaub ins Öl mischt. Davon brennt es schwächer – so stand es in Ambros\' Notizbuch.')),
        go: 'hub',
      },
      shop: {
        say: ['Gildenöl. Versiegelt und geprüft.'],
        choices: [
          buy('oel_trueb', 8),
          { t: 'Fahlstaub verkaufen (4 Münzen)', if: (g) => g.has('fahlstaub'), do: (g) => { g.take('fahlstaub'); g.coins(4); }, go: 'shop' },
          { t: 'Habt ihr kein reines Öl?', if: (g) => once(g, 'k_pure'), do: said('k_pure'), go: 'pure' },
          { t: 'Zurück.', go: 'hub' },
        ],
      },
      pure: { say: ['Reines Öl geht an den Turm. Für das Wohl der Stadt.', '*Er lächelt, als hätte er einen Witz gemacht, den nur er versteht.'], go: 'shop' },
      crate: {
        say: [
          'Ah. Das Beweisstück, nehme ich an. Lenes Öl, sauber wie Quellwasser. Beschlagnahmt, ganz nach Gesetz.',
          'Gib sie mir, und du bekommst fünfunddreißig Münzen. Dann vergisst du den Rest.',
          'Vergessen ist eine Tugend in Kaltenbruch.',
        ],
        choices: [
          { t: 'Nimm sie. (35 Münzen)', go: 'crate_yes',
            do: (g) => { g.take('kiste'); g.coins(35); g.s.flags.kiste_to = 'kassian'; g.xp(30); g.log('kiste', 'Ich habe die Kiste an Kassian verkauft. Lene und Hauptmann Reutter werden das nicht gutheißen.', 'done'); } },
          { t: 'Nein.', go: 'crate_no' },
        ],
      },
      crate_yes: { say: ['Klug. Klugheit ist selten, Junge. Fast so selten wie reines Öl.'] },
      crate_no: { say: ['Wie du meinst.', 'Die Nächte sind lang, Wendel. Und Laternen gehen so leicht aus.'] },
    },
  },

  // ------------------------------------------------------------ Lene
  lene: {
    start: (g) => (['kassian', 'reutter'].includes(g.f('kiste_to')) ? 'cold' : g.f('lene_met') ? 'hub' : 'first'),
    nodes: {
      cold: { say: (g) => [g.f('kiste_to') === 'reutter'
        ? 'Zur Wache bist du gerannt. Mit meiner Kiste. Damit Reutter sich einen Orden an die Brust heften kann, den er nie kriegt.'
        : 'Du hast sie Kassian verkauft. Meine Kiste. Für ein paar Münzen.', 'Geh, bevor ich vergesse, dass ich Ambros mochte.'] },
      first: {
        say: [
          'Noch ein Schritt und du badest. Was willst du?',
          '@Man sagt, du hättest sauberes Öl.',
          'Man redet zu viel. Und man hat recht.',
          'Hatte ich jedenfalls. Bis die Gilde meine letzte Kiste kassiert hat. „Beschlagnahmt."',
          'Liegt jetzt in ihrem Lagerhaus und verstaubt, während die halbe Stadt Wasser verbrennt.',
        ],
        do: (g) => g.set('lene_met'),
        go: 'hub',
      },
      hub: {
        say: (g) => [g.f('lene_friend') ? g.pick(['Lampenjunge. Was brauchst du?', 'Na, noch am Leben?']) : g.pick(['Was noch?', 'Mach schnell.'])],
        choices: [
          { t: 'Soll ich dir deine Kiste zurückholen?', if: (g) => !g.f('kiste_got') && !g.f('kiste_to'), go: 'quest' },
          { t: 'Hier ist deine Kiste.', if: (g) => g.has('kiste'), go: 'deliver' },
          { t: 'Verkaufst du mir Öl?', if: (g) => g.f('lene_friend'), go: 'shop' },
          { t: 'Zeig mir, wie man kämpft.', if: (g) => g.f('lene_friend'), go: 'teach' },
          { t: 'Was weißt du über die Stillen?', if: (g) => once(g, 'l_still'), go: 'still' },
          { t: 'Bis dann.', go: null },
        ],
      },
      quest: {
        say: [
          'Du?',
          '*Sie mustert dich von oben bis unten. Es dauert nicht lange.',
          'Das Lagerhaus ist zu. Vorne jedenfalls. Auf der Ostseite hat der Nebel das Schloss weggefressen. Dafür wohnen jetzt Ratten drin. Große.',
          'Bring mir die Kiste, und ich zahl in Öl. Reinem Öl. Und ich zeig dir, wie man ein Messer hält, ohne sich selbst zu schneiden.',
        ],
        do: (g) => { g.set('kiste_got'); g.log('kiste', 'Die Gilde hat Lenes Kiste mit reinem Öl beschlagnahmt. Sie steht im Lagerhaus südlich des Marktes. Der Eingang auf der Ostseite ist offen, aber dort hausen Ratten.'); },
        go: 'hub',
      },
      deliver: {
        say: [
          'Bei allen ... Du hast sie wirklich.',
          'Vier Flaschen. Zwei für dich. Keine Widerrede, die Ratten haben mehr verdient als ich.',
          'Ambros hat mir mal das Leben gerettet. Hat mich aus dem Wasser gezogen, als ich klein war und dumm.',
          'Jetzt bin ich groß und dumm.',
          'Wenn du ihn findest, sag ihm, Lene schuldet ihm nichts mehr. Er wird lachen.',
        ],
        do: (g) => { g.take('kiste'); g.give('oel_rein', 2); g.s.flags.kiste_to = 'lene'; g.set('lene_friend'); g.xp(30); g.log('kiste', 'Ich habe Lene ihre Kiste zurückgebracht. Sie verkauft mir jetzt reines Öl und bringt mir den Kampf mit der Klinge bei.', 'done'); },
        go: 'hub',
      },
      shop: { say: ['Fünfzehn die Flasche. Freundschaftspreis. Für Fremde wären es zwanzig.'], choices: [buy('oel_rein', 15), { t: 'Zurück.', go: 'hub' }] },
      teach: {
        say: ['Nicht zuschlagen. Treffen. Das ist ein Unterschied.'],
        choices: [teach('dex', 'Geschick', 0, 15), { t: 'Genug für heute.', go: 'hub' }],
      },
      still: {
        say: [
          'Die Gemeinde vom stillen Wasser. Sitzen am Ufer und warten aufs Vergessen.',
          'Früher hab ich über sie gelacht. Dann ist mein Bruder zu ihnen gegangen.',
          'Jetzt lach ich über andere Sachen.',
        ],
        do: said('l_still'),
        go: 'hub',
      },
    },
  },

  // ------------------------------------------------------------ Reutter
  reutter: {
    start: (g) => (g.f('reutter_met') ? 'hub' : 'first'),
    nodes: {
      first: {
        say: [
          'Wenn du einen Diebstahl melden willst: Die Liste ist voll. Wenn du einen Mord melden willst: Die Liste ist auch voll.',
          '@Ambros ist verschwunden.',
          '...',
          'Er war gestern hier. Wollte zwei Mann Begleitung für seine Runde.',
          'Ich hab nein gesagt. Ich hab sechs Männer für eine ganze Stadt, und vier davon trinken.',
          'Ich hab nein gesagt, Junge. Wenn du ihn findest, sag ihm das. Sag ihm, es tut mir leid.',
        ],
        do: (g) => g.set('reutter_met'),
        go: 'hub',
      },
      hub: {
        say: (g) => [g.pick(['Was gibt\'s?', 'Mach\'s kurz.', 'Hm.'])],
        choices: [
          { t: 'Bring mir bei, wie man kämpft.', go: 'teach' },
          { t: 'Die Gilde streckt das Öl.', if: (g) => once(g, 'r_oil'), go: 'oil' },
          { t: 'Ich habe eine beschlagnahmte Kiste aus dem Gildenlager. Reines Öl.', if: (g) => g.has('kiste'), go: 'crate' },
          { t: 'Ich muss weiter.', go: null },
        ],
      },
      teach: {
        say: ['Stärke kommt nicht vom Wollen. Eine Lektion kostet einen Lernpunkt und fünf Münzen. Ich bin nicht die Gilde, aber umsonst ist hier nur der Nebel.'],
        choices: [teach('str', 'Stärke', 5, 15), { t: 'Genug.', go: 'hub' }],
      },
      oil: {
        say: [
          'Weiß ich. Weiß jeder. Beweisen kann\'s keiner.',
          'Kassian zahlt die Hälfte meines Solds, Wendel. Die andere Hälfte bleibt aus.',
          'Bring mir was, das ich einem Richter auf den Tisch stellen kann. Dann reden wir weiter.',
        ],
        do: said('r_oil'),
        go: 'hub',
      },
      crate: {
        say: [
          'Reines Öl in einem Gildenlager, während die Gilde gestrecktes verkauft. Und ein Siegel mit Kassians Zeichen.',
          'Das reicht nicht, um ihn zu hängen. Aber es reicht, um ihn nervös zu machen. Nervöse Männer machen Fehler.',
        ],
        choices: [
          { t: 'Nimm sie. Die Stadt soll es erfahren.', go: 'crate_yes',
            do: (g) => { g.take('kiste'); g.coins(20); g.give('oel_rein'); g.s.flags.kiste_to = 'reutter'; g.xp(30); g.log('kiste', 'Ich habe die Kiste Hauptmann Reutter als Beweis übergeben. Lene wird mir das nicht verzeihen.', 'done'); } },
          { t: 'Ich überleg\'s mir.', go: 'hub' },
        ],
      },
      crate_yes: { say: ['Zwanzig Münzen aus der Wachkasse. Und eine Flasche davon, für deinen Meister.', 'Mehr kann ich nicht tun. Das ist mehr, als ich gestern getan hab.'] },
    },
  },

  // ------------------------------------------------------------ Der Zähler
  zaehler: {
    start: () => 'hub',
    nodes: {
      hub: {
        say: (g) => {
          const n = g.litLamps(), t = g.totalLamps();
          return [`${n}. ${n} brennen von ${t}.`, n >= t ? 'Alle. Alle! Das hatte ich lange nicht mehr.' : 'Gestern waren es mehr. Morgen weniger.'];
        },
        choices: [
          { t: 'Wer bist du?', if: (g) => once(g, 'z_who'), go: 'who' },
          { t: 'Hier, ein Stück Brot.', if: (g) => g.has('brot') && !g.f('z_fed'), go: 'fed' },
          { t: 'Gehen.', go: null },
        ],
      },
      who: {
        say: [
          'Ich zähle. Einer muss zählen. Wenn keiner zählt, merkt keiner, wenn\'s weniger werden.',
          'Früher hab ich Münzen gezählt. Hatte eine Wechselstube am Markt.',
          'Dann wurden die Münzen weniger. Und die Lampen auch. Ich hab mich für das Wichtigere entschieden.',
        ],
        do: said('z_who'),
        go: 'hub',
      },
      fed: {
        say: [
          'Brot. Eins.',
          'Dein Meister hat nicht gesungen, als er zum Friedhof ging. Die anderen singen. Er hat nur gezählt. Leise. Wie ich.',
          'Das heißt, er war noch er selbst. Beeil dich.',
        ],
        do: (g) => { g.take('brot'); g.set('z_fed'); g.xp(10); },
      },
    },
  },

  // ------------------------------------------------------------ Ulm
  ulm: {
    start: () => 'hub',
    nodes: {
      hub: {
        say: ['Der See gibt nichts mehr her. Keine Fische, kein Holz, keine Toten.', 'Nur manchmal gibt er was zurück. Einen Schuh. Ein Lied.'],
        choices: [
          { t: 'Ein Lied?', if: (g) => once(g, 'u_song'), go: 'song' },
          { t: 'Gute Nacht, Ulm.', go: null },
        ],
      },
      song: {
        say: [
          'Nachts, wenn\'s ganz still ist. Kommt vom Südufer, hinter dem Friedhof. Klingt wie eine Gemeinde beim Gottesdienst.',
          'Klingt friedlich.',
          'Das ist das Schlimmste dran. Dass es friedlich klingt.',
        ],
        do: said('u_song'),
      },
    },
  },

  // ------------------------------------------------------------ Borg
  borg: {
    start: () => 'hub',
    nodes: {
      hub: {
        say: ['Weitergehen. Hier gibt\'s nichts zu sehen. Gibt nirgends was zu sehen. Ist zu neblig.'],
        choices: [
          { t: 'Wie läuft der Dienst?', if: (g) => once(g, 'b_job'), go: 'job' },
          { t: 'Schon gut.', go: null },
        ],
      },
      job: {
        say: ['Ich steh hier, damit die Leute sich sicherer fühlen.', 'Ob sie sicherer sind, ist eine andere Frage. Dafür werd ich nicht bezahlt.'],
        do: said('b_job'),
      },
    },
  },

  // ------------------------------------------------------------ Bruder Ohm
  ohm: {
    start: (g) => (g.f('ohm_met') ? 'hub' : 'first'),
    nodes: {
      first: {
        say: [
          'Du trägst Licht. Wie laut das ist.',
          '@Wer bist du?',
          'Ohm. Man nennt mich Bruder. Aber ich habe vergessen, wessen Bruder ich war.',
          'Das ist ein Geschenk, verstehst du?',
          'Nein. Noch nicht.',
        ],
        do: (g) => g.set('ohm_met'),
        go: 'hub',
      },
      hub: {
        say: ['Hmmmm ...'],
        choices: [
          { t: 'Wo ist Ambros?', if: (g) => !g.f('ambros_done'), go: 'where' },
          { t: 'Hast du einen Matthis gekannt?', if: (g) => g.f('matthis_got') && !g.has('medaillon') && !g.f('matthis_done'), go: 'matthis' },
          { t: 'Warum geht ihr ins Wasser?', if: (g) => once(g, 'o_why'), go: 'why' },
          { t: 'Leb wohl, Ohm.', go: null },
        ],
      },
      where: { say: ['Dort, am Wasser. Er sitzt schon die ganze Nacht.', 'Er ist zäh, dein Meister. Er klammert sich an seinen Namen wie an einen Strick.'], go: 'hub' },
      matthis: {
        say: [
          'Matthis. Ja. Er kam an einem Abend mit vielen Tränen und ging mit keinen.',
          'Er sang. Falsch und laut. Dann wurde er still, und das Wasser nahm ihn auf wie eine Mutter.',
          'Er ließ dies hier. Wir behalten keine Dinge. Dinge erinnern.',
        ],
        do: (g) => { g.give('medaillon'); g.log('matthis', 'Bruder Ohm gab mir Matthis\' Medaillon. Matthis ist freiwillig ins Wasser gegangen. Was sage ich Hedda?'); },
        go: 'hub',
      },
      why: {
        say: [
          'Weil es dort nicht wehtut.',
          'Erinnerung ist eine Wunde, Lampenjunge. Ihr verbindet sie jeden Abend mit Licht und wundert euch, dass sie nie heilt.',
        ],
        do: said('o_why'),
        go: 'hub',
      },
    },
  },

  // ------------------------------------------------------------ Ambros
  ambros: {
    start: (g) => (g.f('ambros_saved') ? (g.f('ending_seen') ? 'home_after' : 'home') : 'shore'),
    nodes: {
      shore: {
        say: [
          '*Ambros sitzt auf einem Stein am Wasser. Seine Haut ist grau wie Asche, seine Augen milchig.',
          'Wendel. Du hast die Lampen angezündet. Ich hab\'s gesehen, eine nach der anderen. Wie Sterne, die man von unten anzündet.',
          '@Meister! Komm weg vom Wasser. Du bist ganz grau.',
          'Grau. Ja. So fängt es an. Erst die Farbe, dann die Wärme, dann die Namen.',
          'Ich weiß deinen noch. Das ist gut.',
          'Das Öl, Junge. Die Gilde streckt es seit Jahren. Auch das für den Turm. Das Wachfeuer brennt nur noch halb. Deshalb kommt der Nebel jedes Jahr näher.',
          'Ich wollte die Stillen fragen, warum sie lächeln, wenn sie ins Wasser gehen. Ohm hat es mir erklärt.',
          'Es ist ... freundlich, das Vergessen. Das ist das Schlimmste daran.',
        ],
        go: 'choose',
      },
      choose: {
        say: ['*Ambros\' Atem steht als Wolke vor seinem Mund. Sie wird kleiner.'],
        choices: [
          { t: '[Reines Öl] Ich gieß dir mein Öl in die Laterne. Wärm dich, dann gehen wir heim.', need: (g) => g.has('oel_rein'), go: 'saved',
            do: (g) => { g.take('oel_rein'); } },
          { t: '[Gestrecktes Öl] Versuch es hiermit.', if: (g) => g.has('oel_trueb') && !g.f('a_tried'), go: 'tried',
            do: (g) => { g.take('oel_trueb'); g.set('a_tried'); } },
          { t: 'Ohm hat dich hierher gelockt!', if: (g) => once(g, 'a_ohm'), go: 'ohm' },
          { t: 'Wenn du gehen willst ... dann geh.', go: 'farewell' },
        ],
      },
      tried: {
        say: [
          '*Die Flamme spuckt und zischt. Dampf steigt auf. Wasser im Öl.',
          'Ambros lacht leise, ohne Freude.',
          'Siehst du? Überall. Sogar hier.',
        ],
        go: 'choose',
      },
      ohm: {
        say: [
          'Niemand hat mich gelockt, Junge. Ich bin gekommen, um zu fragen. Und jetzt weiß ich die Antwort.',
          'Das ist das Gefährliche an Antworten. Man kann sie nicht zurückgeben.',
        ],
        do: said('a_ohm'),
        go: 'choose',
      },
      saved: {
        say: [
          '*Die Flamme schlägt hoch, gelb und sauber. Ambros hält die Hände darüber. Lange.',
          'Warm.',
          'Bei allen Heiligen, ich hatte vergessen, wie sich warm anfühlt.',
          '*Farbe kriecht in seine Wangen zurück. Erst wenig. Dann ein bisschen mehr.',
          'Wendel. Wendel. Siehst du? Ich weiß ihn noch.',
          'Nimm den Schlüssel zum Turm. Ich schaff die Treppen heute nicht mehr. Gieß sauberes Öl ins Wachfeuer, nicht das von der Gilde. Dann hält der Nebel Abstand. Für eine Weile.',
          'Ich geh heim. Langsam. Lass mir ein bisschen Licht im Fenster.',
        ],
        do: (g) => { g.give('schluessel_turm'); g.set('ambros_done'); g.set('ambros_saved'); g.xp(60);
          g.log('runde', 'Ich habe Ambros am Ufer gefunden und ihn mit reinem Öl gewärmt. Er geht heim. Mit seinem Schlüssel muss ich auf den Turm und das Wachfeuer mit reinem Öl entzünden.');
          g.ambrosHome(); g.paleRise(); },
      },
      farewell: {
        say: [
          'Du warst ein guter Lehrling. Schlecht im Rechnen, gut im Zuhören. Das Zweite ist wichtiger.',
          'Den Schlüssel. Hier. Das Wachfeuer braucht reines Öl. Versprich mir das.',
          '@Ich verspreche es.',
          '*Ambros steht auf. Er geht ins Wasser, als wäre es ein Flur in einem vertrauten Haus. Bruder Ohm summt.',
          '*Dann ist da nur noch der Nebel.',
        ],
        do: (g) => { g.give('schluessel_turm'); g.set('ambros_done'); g.xp(60);
          g.log('runde', 'Ambros ist ins Wasser gegangen. Er gab mir den Schlüssel zum Turm. Ich habe versprochen, das Wachfeuer mit reinem Öl zu entzünden.');
          g.ambrosGone(); g.paleRise(); },
      },
      home: {
        say: ['Da ist er ja. Setz dich.', 'Nein. Geh. Erst das Wachfeuer. Dann reden wir. Ich lauf nicht weg. Diesmal nicht.'],
      },
      home_after: {
        say: ['Wir haben noch viel Arbeit, Wendel. Die Gilde, das Öl, die Stillen.', 'Aber heute Nacht brennt es. Heute Nacht schläft die Stadt ein bisschen ruhiger.'],
      },
    },
  },

  // ------------------------------------------------------------ Turm
  tower: {
    start: () => 'climb',
    nodes: {
      climb: {
        say: [
          '*Die Tür gibt nach. Dahinter: Treppen. Hundertzwölf, sagt Ambros immer. Du zählst nicht mit.',
          '*Oben ist es kalt. Das Wachfeuer ist eine Schale aus schwarzem Eisen, so groß wie ein Brunnen. Darin schwimmt ein schwacher, milchiger Glanz.',
          '*Unter dir liegt Kaltenbruch. Ein paar Lichter im Nebel. Erstaunlich wenige.',
        ],
        choices: [
          { t: '[Reines Öl] In die Schale gießen.', need: (g) => g.has('oel_rein'), do: (g) => { g.take('oel_rein'); g.ending('pure'); }, go: null },
          { t: '[Gestrecktes Öl] In die Schale gießen.', if: (g) => g.has('oel_trueb'), do: (g) => { g.take('oel_trueb'); g.ending('sick'); }, go: null },
          { t: 'Ich habe nicht das richtige Öl. Ich komme wieder.', go: null },
        ],
      },
    },
  },
};

// Abschluss des ersten Kapitels, abhängig von den Entscheidungen
export function endingText(f, kind) {
  const out = [];
  if (kind === 'pure') {
    out.push('Das Öl fließt in die Schale. Einen Atemzug lang passiert nichts.', 'Dann fängt es Feuer, gelb und weiß und hell, so hell, dass du die Augen schließen musst.', 'Unten weicht der Nebel von den Dächern zurück, wie ein Tier, das sich verbrannt hat.');
  } else {
    out.push('Das Öl fließt in die Schale. Es zischt. Die Flamme richtet sich auf, blass und unruhig.', 'Sie brennt. Für den Moment.', 'Unten bleibt der Nebel, wo er ist. Er hat Zeit.');
  }
  if (f.ambros_saved) out.push('In der Werkstatt brennt eine Kerze im Fenster. Ambros schläft in seinem Stuhl, die Hände um eine warme Laterne gelegt.');
  else out.push('Die Werkstatt ist dunkel. Auf dem Tisch liegt Ambros\' Notizbuch, und die letzte Seite ist noch leer.');
  if (f.matthis_done) out.push(f.matthis_truth ? 'Hedda hat ein Lied angestimmt, im leeren Schankraum. Falsch und laut.' : 'Hedda hat das Medaillon an einen Nagel über dem Tresen gehängt. Sie spricht nicht darüber.');
  if (f.stone_paid) out.push('Auf dem Friedhof steht ein neuer Stein. „Matthis. Geliebt."');
  if (f.kiste_to === 'lene') out.push('Am Hafen verkauft Lene reines Öl, und zum ersten Mal seit Jahren riecht der Markt nach Harz.');
  if (f.kiste_to === 'reutter') out.push('Hauptmann Reutter hat Kassians Kontor versiegeln lassen. Für einen Tag. Vielleicht für zwei.');
  if (f.kiste_to === 'kassian') out.push('Im Kontor der Gilde wird bis spät gerechnet. Kassian Vell hat einen guten Tag gehabt.');
  out.push(kind === 'pure' ? 'Kaltenbruch hat noch eine Nacht. Und noch eine. Mehr verspricht hier niemand.' : 'Der Nebel wird wiederkommen. Aber du weißt jetzt, woher das faule Öl kommt.');
  return out;
}
