import { useState } from 'react';
import { Pressable, Text, View, type TextStyle } from 'react-native';

type Props = {
  text: string;
  style: TextStyle | TextStyle[];
  clampLines?: number;
};

/**
 * Miroir de ExpandableText (web) — "voir plus"/"voir moins" au-delà de `clampLines`.
 * RN n'a pas d'équivalent à scrollHeight/clientHeight pour détecter le dépassement :
 * on mesure via une copie invisible non tronquée (onTextLayout), même technique que
 * ExpandableNote (CuratorPickSection, AddQueueMobile) mais généralisée ici.
 */
export function ExpandableText({ text, style, clampLines = 3 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  return (
    <View>
      {!canExpand && (
        <Text
          style={[style, { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 }]}
          onTextLayout={(e) => {
            if (e.nativeEvent.lines.length > clampLines) setCanExpand(true);
          }}
        >
          {text}
        </Text>
      )}
      <Text numberOfLines={expanded ? undefined : clampLines} style={style}>
        {text}
      </Text>
      {canExpand && (
        <Pressable onPress={() => setExpanded((v) => !v)} className="self-start mt-1 border-b border-accent">
          <Text style={{ fontFamily: 'InstrumentSerif_400Regular_Italic', fontSize: 12.5 }} className="text-accent">
            {expanded ? 'voir moins' : 'voir plus'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
