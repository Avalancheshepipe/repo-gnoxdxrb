import { LegendList, type LegendListRef } from "@legendapp/list/react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import * as Haptics from "expo-haptics";

import { useEffect, useMemo, useRef, useState } from "react";

import {

  ActivityIndicator,

  KeyboardAvoidingView,

  Modal,

  Pressable,

  StyleSheet,

  TextInput,

  View,

} from "react-native";

import Animated, { FadeIn } from "react-native-reanimated";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../src/api";

import { AppHeader } from "../src/components/AppHeader";
import { VoicePermissionOverlay } from "../src/components/VoicePermissionOverlay";

import { useAgentChat } from "../src/hooks/useAgentChat";

import { useOrg } from "../src/hooks/useOrg";

import { useVoiceDictation } from "../src/hooks/useVoiceDictation";

import { useI18n } from "../src/i18n/I18nProvider";

import { t } from "../src/strings";

import { Icon } from "../src/ui/Icon";

import { IconButton } from "../src/ui/IconButton";

import { Icons } from "../src/ui/icons";

import { kavBehavior, kavOffset } from "../src/ui/keyboardAvoiding";

import { PressableScale } from "../src/ui/PressableScale";

import { Txt } from "../src/ui/Txt";

import { useTheme } from "../src/theme/ThemeProvider";

import { radius } from "../src/theme/tokens";



type Agent = { id: string; name: string; role: string };



function AgentSelect({

  agents,

  active,

  onSelect,

}: {

  agents: Agent[];

  active: Agent | null;

  onSelect: (id: string) => void;

}) {

  const { theme } = useTheme();

  const [open, setOpen] = useState(false);



  return (

    <>

      <PressableScale

        haptic={false}

        onPress={() => setOpen(true)}

        style={[

          styles.select,

          { backgroundColor: theme.surface, borderColor: theme.border },

        ]}

      >

        <Icon icon={Icons.agent} size={16} color={theme.accent} />

        <Txt variant="label" numberOfLines={1} style={styles.selectLabel}>

          {active?.name ?? t("agents.pick")}

        </Txt>

        <Icon icon={Icons.arrowDown} size={16} color={theme.muted} />

      </PressableScale>



      <Modal

        visible={open}

        transparent

        animationType="fade"

        onRequestClose={() => setOpen(false)}

      >

        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>

          <Pressable

            style={[

              styles.menu,

              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },

            ]}

          >

            <Txt variant="caption" style={styles.menuLabel}>

              {t("agents.pick").toUpperCase()}

            </Txt>

            {agents.map((a) => {

              const selected = a.id === active?.id;

              return (

                <Pressable

                  key={a.id}

                  onPress={() => {

                    Haptics.selectionAsync().catch(() => {});

                    onSelect(a.id);

                    setOpen(false);

                  }}

                  style={[

                    styles.menuItem,

                    selected && { backgroundColor: theme.accentSoft },

                  ]}

                >

                  <Icon

                    icon={Icons.agent}

                    size={16}

                    color={selected ? theme.accent : theme.muted}

                  />

                  <View style={styles.menuItemText}>

                    <Txt

                      variant="body"

                      color={selected ? theme.accent : theme.fg}

                      numberOfLines={1}

                    >

                      {a.name}

                    </Txt>

                    <Txt variant="caption" numberOfLines={1}>

                      {a.role}

                    </Txt>

                  </View>

                </Pressable>

              );

            })}

          </Pressable>

        </Pressable>

      </Modal>

    </>

  );

}



export default function AgentChatScreen() {

  const { theme } = useTheme();

  const router = useRouter();
  const { agentId: agentIdParam } = useLocalSearchParams<{ agentId?: string }>();

  const insets = useSafeAreaInsets();

  const { locale } = useI18n();

  const { organizationId } = useOrg();

  const listRef = useRef<LegendListRef>(null);



  const agentsQuery = api.agent.list.useQuery(

    { organizationId: organizationId ?? "" },

    { enabled: Boolean(organizationId) },

  );

  const agents = (agentsQuery.data ?? []) as Agent[];



  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  const activeAgent = useMemo(

    () => agents.find((a) => a.id === activeAgentId) ?? agents[0] ?? null,

    [agents, activeAgentId],

  );



  useEffect(() => {
    if (typeof agentIdParam === "string" && agentIdParam) {
      setActiveAgentId(agentIdParam);
      return;
    }
    if (agents.length > 0 && !activeAgentId) {
      setActiveAgentId(agents[0]!.id);
    }
  }, [agents, activeAgentId, agentIdParam]);



  const chat = useAgentChat({

    organizationId: organizationId ?? null,

    agentId: activeAgent?.id ?? null,

    locale,

  });



  const historyQuery = api.chat.history.useQuery(

    {

      organizationId: organizationId ?? "",

      agentId: activeAgent?.id ?? "",

    },

    { enabled: Boolean(organizationId && activeAgent?.id) },

  );



  useEffect(() => {

    chat.reset();

  }, [activeAgent?.id]);



  useEffect(() => {
    if (!activeAgent?.id || !historyQuery.data) return;
    chat.hydrate(historyQuery.data);
  }, [activeAgent?.id, historyQuery.data]);



  const [draft, setDraft] = useState("");

  const voice = useVoiceDictation(setDraft);



  const messages =

    chat.messages.length > 0

      ? chat.messages

      : activeAgent

        ? [{ id: "intro", role: "assistant" as const, content: t("agents.intro") }]

        : [];



  const send = () => {

    const text = draft.trim();

    if (!text) return;

    if (!activeAgent) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    void chat.send(text).then(() => {

      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

    });

    setDraft("");

  };



  const topPad = insets.top + 56 + 8;



  return (

    <View style={styles.flex}>

      <KeyboardAvoidingView

        style={styles.flex}

        behavior={kavBehavior}

        keyboardVerticalOffset={kavOffset}

      >

        {agentsQuery.isLoading ? (

          <View style={[styles.center, { paddingTop: topPad }]}>

            <ActivityIndicator color={theme.accent} />

          </View>

        ) : agents.length === 0 ? (

          <View style={[styles.center, { paddingTop: topPad, paddingHorizontal: 32 }]}>

            <Icon icon={Icons.agent} size={40} color={theme.faint} />

            <Txt variant="muted" style={{ marginTop: 12, textAlign: "center" }}>

              {t("agents.empty")}

            </Txt>

          </View>

        ) : (

          <LegendList

            ref={listRef}

            data={messages}

            keyExtractor={(m) => m.id}

            extraData={chat.isStreaming}

            alignItemsAtEnd

            maintainScrollAtEnd

            contentContainerStyle={{

              paddingTop: topPad,

              paddingBottom: 12,

              paddingHorizontal: 16,

              gap: 10,

            }}

            showsVerticalScrollIndicator={false}

            ListHeaderComponent={

              <View style={styles.selectWrap}>

                <AgentSelect

                  agents={agents}

                  active={activeAgent}

                  onSelect={setActiveAgentId}

                />

                {!activeAgent ? (

                  <Txt variant="caption" style={{ marginTop: 8 }}>

                    {t("agents.selectHint")}

                  </Txt>

                ) : null}

              </View>

            }

            renderItem={({ item }) => (

              <Animated.View

                entering={FadeIn.duration(160)}

                style={[

                  styles.bubble,

                  item.role === "user"

                    ? { alignSelf: "flex-end", backgroundColor: theme.accent }

                    : {

                        alignSelf: "flex-start",

                        backgroundColor: theme.surface,

                        borderWidth: StyleSheet.hairlineWidth,

                        borderColor: theme.border,

                      },

                ]}

              >

                {item.streaming && !item.content ? (

                  <View style={styles.thinkingRow}>

                    <ActivityIndicator size="small" color={theme.muted} />

                    <Txt variant="muted">{t("agents.thinking")}</Txt>

                  </View>

                ) : (

                  <Txt

                    variant="body"

                    color={item.role === "user" ? theme.accentFg : theme.fg}

                  >

                    {item.content}

                  </Txt>

                )}

              </Animated.View>

            )}

          />

        )}



        {agents.length > 0 ? (

          <View

            style={[

              styles.composerWrap,

              { marginBottom: insets.bottom + 10, paddingHorizontal: 16 },

            ]}

          >

            <View

              style={[

                styles.composer,

                { backgroundColor: theme.surface, borderColor: theme.border },

              ]}

            >

              <TextInput

                value={draft}

                onChangeText={setDraft}

                placeholder={t("agents.placeholder")}

                placeholderTextColor={theme.faint}

                style={[styles.input, { color: theme.fg }]}

                multiline

                editable={Boolean(activeAgent) && !chat.isStreaming}

                onSubmitEditing={send}

                returnKeyType="send"

                blurOnSubmit={false}

              />

              <Pressable

                onPress={() => void voice.onMicPress()}

                style={[

                  styles.micBtn,

                  {

                    backgroundColor: voice.recording

                      ? theme.danger

                      : theme.inputBg,

                  },

                ]}

                accessibilityLabel={t("voice.permissionTitle")}

              >

                <Icon

                  icon={Icons.mic}

                  size={17}

                  color={voice.recording ? theme.accentFg : theme.muted}

                />

              </Pressable>

              <Pressable

                onPress={send}

                disabled={!draft.trim() || !activeAgent || chat.isStreaming}

                style={[

                  styles.sendBtn,

                  {

                    backgroundColor:

                      draft.trim() && activeAgent && !chat.isStreaming

                        ? theme.accent

                        : theme.inputBg,

                  },

                ]}

              >

                <Icon

                  icon={Icons.send}

                  size={17}

                  color={

                    draft.trim() && activeAgent && !chat.isStreaming

                      ? theme.accentFg

                      : theme.faint

                  }

                />

              </Pressable>

            </View>

          </View>

        ) : null}

      </KeyboardAvoidingView>



      <AppHeader

        title={t("agents.chatTitle")}

        subtitle={activeAgent?.role}

        left={

          <IconButton

            icon={Icons.arrowLeft}

            onPress={() => router.back()}

            accessibilityLabel={t("common.back")}

          />

        }

      />

      <VoicePermissionOverlay
        visible={voice.overlayVisible}
        mode={voice.overlayMode}
        requesting={voice.requesting}
        onGrant={() => void voice.grantAccess()}
        onDismiss={voice.dismissOverlay}
      />
    </View>

  );

}



const styles = StyleSheet.create({

  flex: { flex: 1 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  selectWrap: { marginBottom: 8 },

  select: {

    flexDirection: "row",

    alignItems: "center",

    gap: 8,

    alignSelf: "flex-start",

    borderRadius: radius.pill,

    borderWidth: StyleSheet.hairlineWidth,

    paddingHorizontal: 12,

    paddingVertical: 8,

  },

  selectLabel: { maxWidth: 220 },

  backdrop: {

    flex: 1,

    backgroundColor: "rgba(0,0,0,0.4)",

    justifyContent: "center",

    paddingHorizontal: 28,

  },

  menu: {

    borderRadius: radius.lg,

    borderWidth: StyleSheet.hairlineWidth,

    padding: 8,

    gap: 2,

  },

  menuLabel: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4, letterSpacing: 0.5 },

  menuItem: {

    flexDirection: "row",

    alignItems: "center",

    gap: 10,

    borderRadius: radius.md,

    paddingHorizontal: 10,

    paddingVertical: 10,

  },

  menuItemText: { flex: 1, minWidth: 0 },

  bubble: {

    maxWidth: "86%",

    borderRadius: 18,

    paddingHorizontal: 14,

    paddingVertical: 10,

  },

  thinkingRow: { flexDirection: "row", alignItems: "center", gap: 8 },

  composerWrap: { paddingTop: 6 },

  composer: {

    flexDirection: "row",

    alignItems: "flex-end",

    gap: 8,

    borderRadius: 24,

    borderWidth: StyleSheet.hairlineWidth,

    padding: 6,

    paddingLeft: 16,

  },

  input: { flex: 1, fontSize: 15, maxHeight: 120, paddingTop: 8, paddingBottom: 8 },

  micBtn: {

    width: 38,

    height: 38,

    borderRadius: 999,

    alignItems: "center",

    justifyContent: "center",

  },

  sendBtn: {

    width: 38,

    height: 38,

    borderRadius: 999,

    alignItems: "center",

    justifyContent: "center",

  },

});


