import Image from "next/image";
import { FloorArt, InspectArt, RollsArt, YarnArt } from "@/components/gallery-art";
import { GallerySlider } from "@/components/gallery-slider";
import { Reveal } from "@/components/reveal";
import { TruckScene } from "@/components/truck-scene";
import { SITE } from "@/lib/site";

const ART = {
  floor: <FloorArt />,
  yarn: <YarnArt />,
  rolls: <RollsArt />,
  inspect: <InspectArt />,
  truck: <TruckScene className="h-full w-full" />,
} as const;

/** Gallery of weaving, yarn, inspection and dispatch. Uses a photo when one is set, an illustration otherwise. */
export function SiteGallery() {
  const tiles = SITE.gallery.map((g) => ({ ...g, art: g.art ? ART[g.art] : null }));
  const credited = SITE.gallery.filter((g) => g.credit);
  return (
    <section id="gallery" className="scroll-mt-16 border-t">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <p className="text-sm font-semibold tracking-widest text-teal uppercase"><span aria-hidden="true">📸</span> Gallery</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">From yarn to fabric</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">How cloth is made: yarn, looms, inspection and dispatch.</p>
        </Reveal>

        <Reveal delay={100} className="mt-8">
          <GallerySlider
            slides={tiles.map((t) => ({
              title: t.title,
              caption: t.caption,
              credit: t.credit,
              media: t.photo ? (
                <Image src={t.photo} alt={t.title} fill sizes="(min-width: 1152px) 1120px, 100vw" className="object-cover" />
              ) : (
                t.art
              ),
            }))}
          />
        </Reveal>

        {credited.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            Photos are representative industry pictures from Wikimedia Commons, used under the licences shown, and are not pictures of our own mill.
          </p>
        )}
      </div>
    </section>
  );
}
