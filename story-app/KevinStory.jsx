import React, { useMemo, useState } from "react";
import { Box, Button, Rows, Text, Title } from "@canva/app-ui-kit";

const CHAPTERS = [
  {
    id: "start",
    eyebrow: "Kevin’s story",
    title: "How it started",
    body: [
      "When I was young, life threw me a curveball I never saw coming — weakness down the right side of my body. My parents were incredibly concerned, so we went straight to the doctor. After MRIs, CT scans, and more, I was wheeled into the operating room to see if I had a tumor in my brain — which I didn’t, thank God!",
      "After all those tests, they decided I had cerebral hemiatrophy. I was eight years old. In plain English: one half of my brain is smaller than the other — “hemi” means half, and “atrophy” means that part of the brain didn’t grow or stay as large as it should. That difference on one side of the brain is what set the stage for everything that came next. A few years later? Oh man — this is where the fun begins."
    ]
  },
  {
    id: "massive",
    eyebrow: "The first big one",
    title: "A massive seizure",
    body: [
      "I had a massive seizure — the kind that stops everything. One minute life is moving; the next, your body is gone and there’s nothing you can do about it. I ended up in the hospital for a few days to recover. Monitors. Questions. Waiting. The slow, shaky climb back to feeling like yourself again.",
      "Those days in a hospital bed change you. You’re not just tired — you’re depleted. Your muscles ache. Your head feels wrong. People you love are scared in a way you can see on their faces even when they try to hide it.",
      "Throughout my life until I graduated high school, I was also having focal aware — or simple partial — seizures. In plain English: a focal aware seizure starts in one area of the brain, and you stay awake and aware while it’s happening. Looking back, those moments were there for years — I did not know that I was having seizures."
    ]
  },
  {
    id: "college",
    eyebrow: "Community college",
    title: "When everything changed",
    body: [
      "In community college I started to have generalized tonic-clonic seizures. In plain English: these are the big ones people usually picture — your whole body stiffens (tonic), then jerks (clonic), and it involves both sides of the brain. You lose awareness.",
      "After much contemplation, I decided to go down to UCLA Medical Center. UCLA’s Neurology & Neurosurgery department routinely ranks among the top 10 in the nation and #1 in Southern California. I was instantly into telemetry so the doctors could find the focal point of my seizures.",
      "Choosing UCLA felt like stepping toward light. I wasn’t running from epilepsy anymore — I was walking into a place built to understand it."
    ]
  },
  {
    id: "2017",
    eyebrow: "2017",
    title: "Left anterior temporal lobectomy",
    body: [
      "In 2017, I went all in. Surgeons performed a left anterior temporal lobectomy — they cut out part of my brain in a desperate, calculated fight to stop the seizures. For a moment, it felt like the war might finally be over.",
      "That decision was not casual. The left temporal lobe is where a lot of what makes you you lives — language, naming, verbal memory. Still, the seizures were already stealing my life. So I chose the risk. I chose the operating room. I chose to fight.",
      "Then, a few months later, lightning struck again: a breakthrough seizure. Hope cracked. The operating room hadn’t been enough. Back to the drawing board."
    ]
  },
  {
    id: "2019",
    eyebrow: "2019",
    title: "Vagus nerve stimulator",
    body: [
      "In 2019 I chose to have a vagus nerve stimulator put in. I wasn’t finished fighting. It helped a little — but breakthrough seizures still came. That didn’t stop me. Resection and VNS were already in. The big guns were out to play — and I was still standing.",
      "When the breakthroughs still showed up, the path ahead pointed somewhere harder: DBS."
    ]
  },
  {
    id: "2022",
    eyebrow: "2022",
    title: "Deep brain stimulation",
    body: [
      "I was done waiting for epilepsy to decide my life. DBS was next — and I chose it on purpose. In consultation with my surgeon, I committed to putting two deep leads in my brain. In 2022, I walked into that operating room ready.",
      "Then came the long fight after the fight: nearly four years with my doctors and the team at Medtronic, refusing to quit until we found a golden setting. On March 18, 2026, they started testing low pulse stimulation 24/7. The DBS has changed my life. My depression has evaporated. I stayed the course. And it held."
    ]
  },
  {
    id: "now",
    eyebrow: "Where I am now",
    title: "The sting isn’t there anymore",
    body: [
      "Now, I am running the LA Marathon. Not as a stunt. Not as a maybe. As a real finish line I am training toward — miles under my feet after years when even a steady day felt like a gamble. I am still having breakthrough seizures about once a month or so. That part didn’t vanish. But the sting isn’t there anymore.",
      "The chains of epilepsy that had bound me for so long were broken. Not because epilepsy disappeared, but because it stopped deciding who I got to be. I no longer fear having a seizure. I respect what my body can do. I prepare. I keep going.",
      "I am so thankful that I have an awesome family that has supported me throughout this long process. This story is mine, but I did not walk it alone. Their love is part of why I’m still standing, still training, still choosing the next mile."
    ]
  }
];

export function KevinStory() {
  const [index, setIndex] = useState(0);
  const chapter = useMemo(() => CHAPTERS[index], [index]);
  const atStart = index === 0;
  const atEnd = index === CHAPTERS.length - 1;

  return (
    <Box padding="2u">
      <Rows spacing="2u">
        <Rows spacing="0.5u">
          <Text size="small" tone="secondary">
            {chapter.eyebrow}
          </Text>
          <Title size="large">{chapter.title}</Title>
          <Text size="small" tone="secondary">
            Chapter {index + 1} of {CHAPTERS.length} · Kevin’s story
          </Text>
        </Rows>

        <Rows spacing="1.5u">
          {chapter.body.map((paragraph) => (
            <Text key={paragraph.slice(0, 32)}>{paragraph}</Text>
          ))}
        </Rows>

        <Rows spacing="1u">
          <Button
            variant="primary"
            stretch
            disabled={atEnd}
            onClick={() => setIndex((i) => Math.min(CHAPTERS.length - 1, i + 1))}
          >
            {atEnd ? "End of story" : "Next chapter"}
          </Button>
          <Button
            variant="secondary"
            stretch
            disabled={atStart}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            Previous
          </Button>
        </Rows>
      </Rows>
    </Box>
  );
}
