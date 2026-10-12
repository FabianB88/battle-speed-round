# Battle Speed Round

Een mobiele quizbuzzer met één grote drukknop, hoorbaar alarm en een live beheerscherm. De beheerder zet per ronde een vraag klaar, deelt een kamercode en opent de ronde. Deelnemers hebben geen account nodig.

## Gebruik

1. Open de app en kies **Beheer**. Log in met het privé aangemaakte beheeraccount.
2. Maak een kamer. Deel de kamercode of de deelnemerslink.
3. Vul een vraag in. **Vraag opslaan** toont hem alvast op de telefoons.
4. Kies **Start ronde**. Elke deelnemer kan één keer drukken.
5. De beheerder ziet de winnaar en de volledige volgorde live. **Nieuwe ronde** maakt alle knoppen weer klaar.

Deelnemers horen een alarm na bevestiging van hun druk. Het beheerscherm geeft een alarm bij de eerste druk. Browsers activeren geluid na een tik; gebruik de geluidsknop als geluid nog niet actief is. Houd de app op de voorgrond tijdens het spelen.

## Data en toegang

- Firebase Authentication verzorgt anonieme deelnemerssessies en het beheeraccount met e-mail en wachtwoord.
- Firestore-transacties reserveren opeenvolgende posities; er kan slechts één eerste druk per ronde zijn. Internetvertraging kan de volgorde van vrijwel gelijktijdige fysieke tikken beïnvloeden.
- Beveiligingsregels controleren beheerrechten, kamerlidmaatschap, eenmalige drukken, de positie, de vraag en de ronde.
- De publieke Firebase-configuratie bevat geen beheerderswachtwoord of servicetoken.
- Privé inloggegevens worden uitsluitend lokaal bewaard in het genegeerde `ADMIN-TOEGANG.txt` en `.local/`. Ze worden niet meegestuurd naar hosting of GitHub.
- Het beheeraccount kan zijn wachtwoord wijzigen via **Alle kamers → Wachtwoord wijzigen**.
- De lijst toont aangemelde deelnemers, geen gegarandeerde actuele aanwezigheid.

## Publiceren

De map `docs/` bevat de volledige webapp en kan rechtstreeks op GitHub Pages draaien. Dezelfde map wordt op Firebase Hosting gepubliceerd. Firebase verzorgt de gezamenlijke data voor beide URLs.

```sh
firebase deploy --only auth,firestore,hosting --project battle-speed-round-fb88
```

Firebase-project: `battle-speed-round-fb88`. Databaseregio: Europa (`eur3`). Er is geen betaald abonnement geactiveerd.

GitHub Pages: kies branch `main` en map `/docs`. Na wijzigingen aan de frontend moet de nieuwe bron naar GitHub worden gepusht; Firebase Hosting wordt met de bovenstaande opdracht bijgewerkt.
