# HomeCelebrationToast

Fejrings-toasten "Dagsmål nået" (`app-home-celebration-toast`), der popper frem øverst på
Hjem, når dagens kalorier når målet. Den er `position: absolute` i forhold til siden og
ligger i `--z-index-toast`.

Animationerne er designets egne: `badgePop` ind og `badgeOut` ud efter 2,9 s. Selve
levetiden styres af `HomePage`, som også rydder timeren. Output `dismissed`, når brugeren
trykker toasten væk.

Wrapperen (`:host`) står for centreringen, og knappen for animationen – ellers ville
`badgePop`s `transform` overskrive `translateX(-50%)`.
