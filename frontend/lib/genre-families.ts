export type GenreEntry = { label: string; slug: string };
export type GenreFamily = GenreEntry & { subgenres: GenreEntry[] };

export const GENRE_FAMILIES: GenreFamily[] = [
    { label: 'Hip-hop / Rap',     slug: 'hip-hop',    subgenres: [
        { label: 'Rap français',     slug: 'rap-francais'      },
        { label: 'Trap',             slug: 'trap'              },
        { label: 'Drill',            slug: 'drill'             },
        { label: 'UK drill',         slug: 'uk-drill'          },
        { label: 'Boom bap',         slug: 'boom-bap'          },
        { label: 'Rap conscient',    slug: 'conscious-rap'     },
        { label: 'Cloud rap',        slug: 'cloud-rap'         },
        { label: 'Melodic rap',      slug: 'melodic-rap'       },
        { label: 'Phonk',            slug: 'phonk'             },
        { label: 'Pluggnb',          slug: 'pluggnb'           },
        { label: 'Afrotrap',         slug: 'afrotrap'          },
        { label: 'Lo-fi hip-hop',    slug: 'lo-fi-hip-hop'     },
        { label: 'UK rap',           slug: 'uk-rap'            },
        { label: 'Grime',            slug: 'grime'             },
    ]},
    { label: 'R&B / Soul',        slug: 'soul',       subgenres: [
        { label: 'Neo-soul',         slug: 'neo-soul'          },
        { label: 'R&B contemporain', slug: 'contemporary-rnb'  },
        { label: 'PBR&B',            slug: 'pbrnb'             },
        { label: 'Quiet storm',      slug: 'quiet-storm'       },
        { label: 'Gospel',           slug: 'gospel'            },
        { label: 'Funk soul',        slug: 'funk-soul'         },
    ]},
    { label: 'Pop',               slug: 'pop',        subgenres: [
        { label: 'Indie pop',        slug: 'indie-pop'         },
        { label: 'Bedroom pop',      slug: 'bedroom-pop'       },
        { label: 'Synth-pop',        slug: 'synth-pop'         },
        { label: 'Dream pop',        slug: 'dream-pop'         },
        { label: 'Dance-pop',        slug: 'dance-pop'         },
        { label: 'Art pop',          slug: 'art-pop'           },
        { label: 'Hyperpop',         slug: 'hyperpop'          },
        { label: 'K-pop',            slug: 'k-pop'             },
        { label: 'Pop arabe',        slug: 'arabic-pop'        },
    ]},
    { label: 'Rock',              slug: 'rock',       subgenres: [
        { label: 'Indie rock',       slug: 'indie-rock'        },
        { label: 'Alt. rock',        slug: 'alternative-rock'  },
        { label: 'Punk',             slug: 'punk'              },
        { label: 'Post-punk',        slug: 'post-punk'         },
        { label: 'Post-rock',        slug: 'post-rock'         },
        { label: 'Shoegaze',         slug: 'shoegaze'          },
        { label: 'Noise rock',       slug: 'noise-rock'        },
        { label: 'Math rock',        slug: 'math-rock'         },
        { label: 'Grunge',           slug: 'grunge'            },
        { label: 'Psychédélique',    slug: 'psychedelic-rock'  },
        { label: 'Garage rock',      slug: 'garage-rock'       },
        { label: 'Emo',              slug: 'emo'               },
    ]},
    { label: 'Électronique',      slug: 'electronic', subgenres: [
        { label: 'House',            slug: 'house'             },
        { label: 'Deep house',       slug: 'deep-house'        },
        { label: 'Techno',           slug: 'techno'            },
        { label: 'Ambient',          slug: 'ambient'           },
        { label: 'Drum & Bass',      slug: 'drum-and-bass'     },
        { label: 'Trip-hop',         slug: 'trip-hop'          },
        { label: 'IDM',              slug: 'idm'               },
        { label: 'Trance',           slug: 'trance'            },
        { label: 'UK garage',        slug: 'uk-garage'         },
        { label: 'Vaporwave',        slug: 'vaporwave'         },
        { label: 'Electro',          slug: 'electro'           },
        { label: 'Breakbeat',        slug: 'breakbeat'         },
    ]},
    { label: 'Jazz',              slug: 'jazz',       subgenres: [
        { label: 'Bebop',            slug: 'bebop'             },
        { label: 'Hard bop',         slug: 'hard-bop'          },
        { label: 'Cool jazz',        slug: 'cool-jazz'         },
        { label: 'Modal jazz',       slug: 'modal-jazz'        },
        { label: 'Free jazz',        slug: 'free-jazz'         },
        { label: 'Jazz fusion',      slug: 'jazz-fusion'       },
        { label: 'Nu jazz',          slug: 'nu-jazz'           },
        { label: 'Jazz rap',         slug: 'jazz-rap'          },
    ]},
    { label: 'Folk / Acoustique', slug: 'folk',       subgenres: [
        { label: 'Indie folk',       slug: 'indie-folk'        },
        { label: 'Singer-songwriter',slug: 'singer-songwriter' },
        { label: 'Bluegrass',        slug: 'bluegrass'         },
        { label: 'Country',          slug: 'country'           },
    ]},
    { label: 'Classique',         slug: 'classical',  subgenres: [
        { label: 'Baroque',          slug: 'baroque'           },
        { label: 'Romantique',       slug: 'romantic'          },
        { label: 'Minimaliste',      slug: 'minimalism'        },
        { label: 'Opéra',            slug: 'opera'             },
    ]},
    { label: 'Metal',             slug: 'metal',      subgenres: [
        { label: 'Heavy metal',      slug: 'heavy-metal'       },
        { label: 'Death metal',      slug: 'death-metal'       },
        { label: 'Black metal',      slug: 'black-metal'       },
        { label: 'Doom metal',       slug: 'doom-metal'        },
        { label: 'Post-metal',       slug: 'post-metal'        },
    ]},
    { label: 'Reggae',            slug: 'reggae',     subgenres: [
        { label: 'Dancehall',        slug: 'dancehall'         },
        { label: 'Dub',              slug: 'dub'               },
        { label: 'Roots reggae',     slug: 'roots-reggae'      },
        { label: 'Ska',              slug: 'ska'               },
    ]},
    { label: 'Funk',              slug: 'funk',       subgenres: [
        { label: 'P-funk',           slug: 'p-funk'            },
        { label: 'Funk rock',        slug: 'funk-rock'         },
        { label: 'Disco',            slug: 'disco'             },
    ]},
    { label: 'Latin',             slug: 'latin',      subgenres: [
        { label: 'Reggaeton',        slug: 'reggaeton'         },
        { label: 'Salsa',            slug: 'salsa'             },
        { label: 'Bossa nova',       slug: 'bossa-nova'        },
        { label: 'Cumbia',           slug: 'cumbia'            },
    ]},
    { label: 'Afrobeats',         slug: 'afrobeats',  subgenres: [
        { label: 'Amapiano',         slug: 'amapiano'          },
        { label: 'Afropop',          slug: 'afropop'           },
        { label: 'Highlife',         slug: 'highlife'          },
        { label: 'Afroswing',        slug: 'afroswing'         },
        { label: 'Kuduro',           slug: 'kuduro'            },
    ]},
    { label: 'Blues',             slug: 'blues',      subgenres: [
        { label: 'Delta blues',      slug: 'delta-blues'       },
        { label: 'Chicago blues',    slug: 'chicago-blues'     },
    ]},
    { label: 'Bande originale',   slug: 'soundtrack', subgenres: [
        { label: 'Film',             slug: 'film-score'        },
        { label: 'Jeux vidéo',       slug: 'video-game-music'  },
    ]},
];

export function findGenreBySlug(slug: string): GenreEntry | null {
    for (const family of GENRE_FAMILIES) {
        if (family.slug === slug) return { label: family.label, slug: family.slug };
        for (const sub of family.subgenres) {
            if (sub.slug === slug) return sub;
        }
    }
    return null;
}

export type GenreSlug = string;
