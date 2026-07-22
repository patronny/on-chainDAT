#!/usr/bin/env python3
"""Unit tests for monitor.py's keeper-balance and arbitrage-opportunity decision
logic (the pure functions - no network). Run: python3 -m unittest test_monitor -v

monitor.py reads TG_CHAT_ID at import, so seed a dummy before importing it."""
import os
import unittest

os.environ.setdefault("TG_CHAT_ID", "test")

import monitor  # noqa: E402


class ParseEth(unittest.TestCase):
    """Guards the keeper /status ETH fields: a missing key (warmup payload) or "?"
    (error branch) is unknown, NOT a real 0.0 balance."""

    def test_numeric_strings(self):
        self.assertEqual(monitor.parse_eth("0.5"), 0.5)
        self.assertEqual(monitor.parse_eth("-0.1657"), -0.1657)
        self.assertEqual(monitor.parse_eth("0.0"), 0.0)

    def test_unknown_is_none(self):
        self.assertIsNone(monitor.parse_eth(None))     # missing key (warmup)
        self.assertIsNone(monitor.parse_eth("?"))      # keeper error branch
        self.assertIsNone(monitor.parse_eth("warming up"))


class KeeperBalance(unittest.TestCase):
    """Edge-triggered: one note down, one note up, never a repeated nag; the first
    observation after a (re)start baselines silently (owner already acknowledged)."""

    def test_baseline_is_silent(self):
        d = {}
        self.assertIsNone(monitor.keeper_balance_msg("LineaDAT", 0.0015, d))
        self.assertTrue(d["keeperLow"])

    def test_stays_low_never_spams(self):
        d = {}
        monitor.keeper_balance_msg("LineaDAT", 0.0015, d)  # baseline
        for _ in range(5):
            self.assertIsNone(monitor.keeper_balance_msg("LineaDAT", 0.001, d))

    def test_recovery_fires_once(self):
        d = {}
        monitor.keeper_balance_msg("LineaDAT", 0.0015, d)  # baseline low
        msg = monitor.keeper_balance_msg("LineaDAT", 0.5, d)
        self.assertIsNotNone(msg)
        self.assertIn("recovered", msg)
        self.assertTrue(msg.startswith("\U0001f7e2"))  # green
        self.assertFalse(d["keeperLow"])
        self.assertIsNone(monitor.keeper_balance_msg("LineaDAT", 0.6, d))

    def test_drop_after_recovery_fires_once(self):
        d = {}
        monitor.keeper_balance_msg("LineaDAT", 0.0015, d)  # baseline low
        monitor.keeper_balance_msg("LineaDAT", 0.5, d)     # recovered
        msg = monitor.keeper_balance_msg("LineaDAT", 0.1, d)
        self.assertIsNotNone(msg)
        self.assertTrue(msg.startswith("\U0001f534"))  # red
        self.assertIn("BUYs will stall", msg)
        self.assertTrue(d["keeperLow"])
        self.assertIsNone(monitor.keeper_balance_msg("LineaDAT", 0.05, d))


class ArbReadiness(unittest.TestCase):
    def test_math_matches_live_status(self):
        # live 2026-07-22 keeper /status: funds 0.0377, edge -0.1657 -> needed ~0.2034
        r, needed = monitor.arb_readiness(0.037659, -0.165748)
        self.assertAlmostEqual(needed, 0.203407, places=4)
        self.assertAlmostEqual(r, 0.185145, places=4)

    def test_edge_zero_is_fully_ready(self):
        r, needed = monitor.arb_readiness(0.2034, 0.0)
        self.assertAlmostEqual(r, 1.0, places=6)

    def test_positive_edge_over_one(self):
        r, _ = monitor.arb_readiness(0.21, 0.005)
        self.assertGreater(r, 1.0)

    def test_missing_data_returns_none(self):
        self.assertEqual(monitor.arb_readiness(None, -0.1), (None, None))
        self.assertEqual(monitor.arb_readiness(0.1, None), (None, None))

    def test_degenerate_needed_returns_none(self):
        # edge >= funds is physically impossible (edge = funds - cost - gas); guard anyway
        self.assertEqual(monitor.arb_readiness(0.1, 0.1), (None, None))


class ArbStage(unittest.TestCase):
    def test_stages(self):
        self.assertEqual(monitor.arb_stage(0.5, -0.1), 0)     # far
        self.assertEqual(monitor.arb_stage(0.93, -0.014), 1)  # approaching
        self.assertEqual(monitor.arb_stage(1.02, 0.004), 2)   # live (edge>=0)
        self.assertEqual(monitor.arb_stage(1.0, 0.0), 2)      # exactly at the gate


class ArbOpportunity(unittest.TestCase):
    """Two escalating stages (approaching >=90%, LIVE when buyEdge>=0), each paged once
    per window, debounced (2 polls) and re-armed only after readiness drops below 80%."""

    NEEDED = 0.2034

    def _inputs(self, readiness):
        """funds/edge such that funds/(funds-edge) == readiness with needed fixed."""
        funds = readiness * self.NEEDED
        edge = funds - self.NEEDED
        return funds, edge

    def test_far_from_window_stays_silent(self):
        d = {}
        f, e = self._inputs(0.185)
        for _ in range(5):
            self.assertIsNone(monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d))

    def test_approaching_debounce_then_fire_once(self):
        d = {}
        f, e = self._inputs(0.93)  # edge<0 -> stage 1
        self.assertIsNone(monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d))  # streak 1
        msg = monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d)               # streak 2 -> fire
        self.assertIsNotNone(msg)
        self.assertIn("opening soon", msg)
        self.assertNotIn("LIVE", msg)
        self.assertIn("93%", msg)
        self.assertIn("0xc31E", msg)
        # stays approaching -> already paged -> silent
        self.assertIsNone(monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d))
        self.assertIsNone(monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d))

    def test_escalates_to_live_after_approaching(self):
        d = {}
        f1, e1 = self._inputs(0.93)
        monitor.arb_opportunity_msg("LineaDAT", f1, e1, 0.0, d)
        monitor.arb_opportunity_msg("LineaDAT", f1, e1, 0.0, d)  # approaching paged
        f2, e2 = 0.2100, 0.0060  # edge>=0 -> stage 2 LIVE
        self.assertIsNone(monitor.arb_opportunity_msg("LineaDAT", f2, e2, 0.0, d))  # streak 1
        msg = monitor.arb_opportunity_msg("LineaDAT", f2, e2, 0.0, d)               # streak 2 -> fire
        self.assertIsNotNone(msg)
        self.assertIn("LIVE NOW", msg)
        # widening further -> already at top stage -> silent (no spam)
        self.assertIsNone(monitor.arb_opportunity_msg("LineaDAT", 0.22, 0.017, 0.0, d))

    def test_fast_climb_fires_live_only(self):
        d = {}
        f, e = 0.2100, 0.0060  # jumps straight to LIVE from nothing
        self.assertIsNone(monitor.arb_opportunity_msg("LineaDAT", f, e, 0.05, d))  # streak 1
        msg = monitor.arb_opportunity_msg("LineaDAT", f, e, 0.05, d)               # streak 2 -> fire
        self.assertIn("LIVE NOW", msg)

    def test_topup_gap_reported(self):
        d = {}
        f, e = 0.2100, 0.0060  # needed = f - e = 0.204
        monitor.arb_opportunity_msg("LineaDAT", f, e, 0.05, d)
        msg = monitor.arb_opportunity_msg("LineaDAT", f, e, 0.05, d)
        # gap = needed - keeperEth = 0.204 - 0.05 = 0.154
        self.assertIn("0.154", msg)
        self.assertIn("Keeper holds 0.0500 ETH", msg)

    def test_hysteresis_rearm_and_refire(self):
        d = {}
        f, e = self._inputs(0.93)
        monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d)
        monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d)  # approaching paged
        # window closes (< 80%) -> re-arm
        lf, le = self._inputs(0.5)
        self.assertIsNone(monitor.arb_opportunity_msg("LineaDAT", lf, le, 0.0, d))
        self.assertEqual(d["arbStagePaged"], 0)
        # climbs back -> approaching fires again after 2 polls
        self.assertIsNone(monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d))
        self.assertIsNotNone(monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d))

    def test_deadband_80_to_90_does_not_rearm(self):
        d = {}
        f, e = self._inputs(0.93)
        monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d)
        monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d)  # approaching paged
        mf, me = self._inputs(0.85)  # below 90% (stage 0) but >= 80% -> no re-arm
        monitor.arb_opportunity_msg("LineaDAT", mf, me, 0.0, d)
        self.assertEqual(d["arbStagePaged"], 1)  # still latched
        # back to 93% must NOT re-fire approaching (never re-armed)
        monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d)
        self.assertIsNone(monitor.arb_opportunity_msg("LineaDAT", f, e, 0.0, d))

    def test_missing_quote_is_silent_and_keeps_state(self):
        d = {"arbStageSeen": 1, "arbStageStreak": 2, "arbStagePaged": 1}
        self.assertIsNone(monitor.arb_opportunity_msg("LineaDAT", 0.1, None, 0.0, d))
        self.assertEqual(d["arbStagePaged"], 1)  # untouched by a missing-quote poll


if __name__ == "__main__":
    unittest.main()
