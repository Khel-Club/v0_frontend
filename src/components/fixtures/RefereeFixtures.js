import React, { useState } from 'react';
import styles from './Fixtures.module.scss';
import BaseFixtures from './BaseFixtures';
import { useRouter } from 'next/navigation';

const RefereeFixtures = ({ tournamentId, totalRounds }) => {
    const router = useRouter();
    const [filterType, setFilterType] = useState('courtwise');

    const {
        matches,
        loading,
        selectedRound,
        selectedPoolId,
        selectedCourt,
        setSelectedCourt,
        getFilteredMatches,
        handleRoundClick,
        handlePoolClick
    } = BaseFixtures({ 
        tournamentId, 
        totalRounds,
        showCourtInfo: true 
    });

    const handleMatchClick = (match) => {
        router.push(`/referee/${tournamentId}/matches/${match.match_id}`);
    };

    const getAvailableCourts = () => {
        const courts = new Set();
        Object.values(matches).forEach(round => {
            Object.values(round.pools).forEach(pool => {
                pool.forEach(match => {
                    if (match.court_number) {
                        courts.add(match.court_number);
                    }
                });
            });
        });
        return Array.from(courts).sort((a, b) => a - b);
    };

    const handleCourtClick = (courtNumber) => {
        setSelectedCourt(courtNumber === selectedCourt ? null : courtNumber);
    };

    const renderMatches = (matches = []) => {
        if (!Array.isArray(matches)) return null;
        
        return matches.map((match) => (
            <div
                key={match.match_id}
                className={`${styles.matchCard} ${match.status === 'completed' ? styles.completed : ''} ${styles.refereeMode}`}
                onClick={() => handleMatchClick(match)}
            >
                <div className={styles.matchId}>
                    Match ID: {match.match_id}
                </div>

                <div className={styles.teams}>
                    <div className={`${styles.team} ${
                        match.winner_team_id === match.team1_id ? styles.winner : ''
                    } ${match.team1_checked_in === true ? styles.checkedIn : ''}`}>
                        <div className={styles.teamPlayers}>{match.team1_players}</div>
                        {match.team1_id && (
                            <div className={styles.teamId}>Team ID: {match.team1_id}</div>
                        )}
                        <div className={styles.score}>{match.team1Score}</div>
                    </div>
                    <div className={styles.vs}>vs</div>
                    <div className={`${styles.team} ${
                        match.winner_team_id === match.team2_id ? styles.winner : ''
                    } ${match.team2_checked_in === true ? styles.checkedIn : ''}`}>
                        <div className={styles.teamPlayers}>{match.team2_players}</div>
                        {match.team2_id && (
                            <div className={styles.teamId}>Team ID: {match.team2_id}</div>
                        )}
                        <div className={styles.score}>{match.team2Score}</div>
                    </div>
                </div>

                <div className={styles.matchInfo}>
                    {match.outcome === 'walkover' && <span className={styles.walkover}>Walkover</span>}
                    <span className={styles.pool}>Pool: {match.pool}</span>
                    <span className={styles.round}>{match.round_name}</span>
                    {match.court_number && (
                        <span className={styles.courtAssigned}>
                            Court: {match.court_number}
                        </span>
                    )}
                    <span className={`${styles.status} ${styles[match.status]}`}>
                        {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                    </span>
                </div>
            </div>
        ));
    };

    if (loading) {
        return <div className={styles.loading}>Loading matches...</div>;
    }

    return (
        <div className={styles.fixturesContainer}>
            {/* Round Tabs */}
            <div className={styles.roundTabs}>
                {Object.entries(matches)
                    .sort(([a], [b]) => Number(b) - Number(a))
                    .map(([roundId, roundData]) => (
                        <button
                            key={roundId}
                            className={`${styles.roundTab} ${selectedRound === roundId ? styles.active : ''}`}
                            onClick={() => handleRoundClick(roundId)}
                        >
                            {roundData.round_name}
                        </button>
                ))}
            </div>

            {/* Filter Type Selection */}
            <div className={styles.filterTypeTabs}>
                <button
                    className={`${styles.filterTypeTab} ${filterType === 'courtwise' ? styles.active : ''}`}
                    onClick={() => setFilterType('courtwise')}
                >
                    Court-wise
                </button>
                <button
                    className={`${styles.filterTypeTab} ${filterType === 'poolwise' ? styles.active : ''}`}
                    onClick={() => setFilterType('poolwise')}
                >
                    Pool-wise
                </button>
            </div>

            {/* Conditional Filter Tabs */}
            {filterType === 'poolwise' && selectedRound && matches[selectedRound]?.pools && (
                <div className={styles.poolTabs}>
                    {Object.keys(matches[selectedRound].pools)
                        .filter(poolId => poolId !== 'unassigned')
                        .sort()
                        .map((poolId) => (
                            <button
                                key={poolId}
                                className={`${styles.poolTab} ${selectedPoolId === poolId ? styles.active : ''}`}
                                onClick={() => handlePoolClick(poolId)}
                            >
                                {poolId}
                            </button>
                    ))}
                </div>
            )}

            {filterType === 'courtwise' && (
                <div className={styles.courtTabs}>
                    {getAvailableCourts().map((courtNumber) => (
                        <button
                            key={courtNumber}
                            className={`${styles.courtTab} ${selectedCourt === courtNumber ? styles.active : ''}`}
                            onClick={() => handleCourtClick(courtNumber)}
                        >
                            Court {courtNumber}
                        </button>
                    ))}
                </div>
            )}

            {/* Matches Grid */}
            <div className={styles.matchesGrid}>
                {getFilteredMatches()?.length === 0 ? (
                    <div className={styles.noMatches}>No matches available</div>
                ) : (
                    renderMatches(getFilteredMatches())
                )}
            </div>
        </div>
    );
};

export default RefereeFixtures; 