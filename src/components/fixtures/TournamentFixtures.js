import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './Fixtures.module.scss';
import BaseFixtures from './BaseFixtures';
import KnockoutBracket from './KnockoutBracket';
import KnockoutBracket2 from './KnockoutBracket2';
import { endpoints } from '@/store/urls';
import { apiCall } from '@/store/utils';
import toast from 'react-hot-toast';

const TournamentFixtures = ({ tournamentId, totalRounds }) => {
    const router = useRouter();
    const [filterType, setFilterType] = useState('poolwise');
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [showKnockouts, setShowKnockouts] = useState(false);
    const [knockoutView, setKnockoutView] = useState('default'); // 'default' or 'alternate'
    const [knockoutMatches, setKnockoutMatches] = useState([]);

    // Function to parse match results
    const parseMatchResult = (result) => {
        if (!result) return { team1Score: 0, team2Score: 0 };
        const scores = result.split('-').map(Number);
        return {
            team1Score: scores[0] || 0,
            team2Score: scores[1] || 0
        };
    };

    // Fetch knockout matches separately
    const fetchKnockoutMatches = async () => {
        try {
            const response = await apiCall(`${endpoints.getFixtures}?tournament_id=${tournamentId}`);
            if (response && response.matches) {
                const knockoutMatchesArray = response.matches
                    .filter(match => match.bracket_info)
                    .map(match => ({
                        ...match,
                        match_id: `${match.match_id}-${match.round_name}-${match.bracket_info.bracket_position}`,
                        ...parseMatchResult(match.match_result),
                        status: match.match_status?.status || 'pending',
                        winner_team_id: match.match_status?.is_final ? match.match_status?.winner_team_id : null,
                    }));
                setKnockoutMatches(knockoutMatchesArray);
            }
        } catch (error) {
            console.error('Error fetching knockout matches:', error);
            toast.error('Failed to fetch knockout matches');
        }
    };

    // Fetch knockout matches when component mounts or tournamentId changes
    useEffect(() => {
        if (tournamentId) {
            fetchKnockoutMatches();
        }
    }, [tournamentId]);

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

    const filterMatchesByStatus = (matches) => {
        if (!selectedStatus) return matches;
        return matches.filter(match => match.status === selectedStatus);
    };

    const renderFilteredMatches = () => {
        const matches = getFilteredMatches();
        return filterMatchesByStatus(matches);
    };

    const handleMatchClick = (match) => {
        if (match?.match_id) {
            window.open(`/tournament/overlay?tournament=${tournamentId}&match=${match.match_id}`, '_blank');
        }
    };

    const renderMatches = (matches = []) => {
        if (!Array.isArray(matches)) return null;
        
        return matches.map((match) => (
            <div
                key={match.match_id}
                className={`${styles.matchCard} ${match.status === 'completed' ? styles.completed : ''}`}
                onClick={() => handleMatchClick(match)}
            >
                <div className={styles.matchId}>
                    Match ID: {match.match_id}
                </div>

                <div className={styles.teams}>
                    <div className={`${styles.team} ${
                        match.winner_team_id && match.winner_team_id === match.team1_id ? styles.winner : ''
                    } ${match.team1_checked_in === true ? styles.checkedIn : ''}`}>
                        <div className={styles.teamPlayers}>{match.team1_players}</div>
                        {match.team1_id && (
                            <div className={styles.teamId}>Team ID: {match.team1_id}</div>
                        )}
                        <div className={styles.score}>{match.team1Score}</div>
                    </div>
                    <div className={styles.vs}>vs</div>
                    <div className={`${styles.team} ${
                        match.winner_team_id && match.winner_team_id === match.team2_id ? styles.winner : ''
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
            {/* View Type Tabs */}
            <div className={styles.viewTypeTabs}>
                <button
                    className={`${styles.viewTypeTab} ${!showKnockouts ? styles.active : ''}`}
                    onClick={() => setShowKnockouts(false)}
                >
                    Round Robin
                </button>
                <button
                    className={`${styles.viewTypeTab} ${showKnockouts && knockoutView === 'default' ? styles.active : ''}`}
                    onClick={() => {
                        setShowKnockouts(true);
                        setKnockoutView('default');
                    }}
                >
                    Knockouts
                </button>
                <button
                    className={`${styles.viewTypeTab} ${showKnockouts && knockoutView === 'alternate' ? styles.active : ''}`}
                    onClick={() => {
                        setShowKnockouts(true);
                        setKnockoutView('alternate');
                    }}
                >
                    Knockouts Alt
                </button>
            </div>

            {showKnockouts ? (
                <div className={styles.knockoutContainer}>
                    {knockoutMatches.length > 0 ? (
                        knockoutView === 'default' ? (
                            <KnockoutBracket 
                                matches={knockoutMatches} 
                            />
                        ) : (
                            <KnockoutBracket2 
                                matches={knockoutMatches} 
                            />
                        )
                    ) : (
                        <div className={styles.noMatches}>No knockout matches available</div>
                    )}
                </div>
            ) : (
                <>
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

                    {selectedRound && (
                        <>
                            {/* Filter Type Selection */}
                            <div className={styles.filterTypeTabs}>
                                <button
                                    className={`${styles.filterTypeTab} ${filterType === 'courtwise' ? styles.active : ''}`}
                                    onClick={() => {
                                        setFilterType('courtwise');
                                        setSelectedPoolId(null);
                                        setSelectedStatus(null);
                                    }}
                                >
                                    Court-wise
                                </button>
                                <button
                                    className={`${styles.filterTypeTab} ${filterType === 'poolwise' ? styles.active : ''}`}
                                    onClick={() => {
                                        setFilterType('poolwise');
                                        setSelectedCourt(null);
                                        setSelectedStatus(null);
                                    }}
                                >
                                    Pool-wise
                                </button>
                                <button
                                    className={`${styles.filterTypeTab} ${filterType === 'statuswise' ? styles.active : ''}`}
                                    onClick={() => {
                                        setFilterType('statuswise');
                                        setSelectedCourt(null);
                                        setSelectedPoolId(null);
                                    }}
                                >
                                    Status-wise
                                </button>
                            </div>

                            {/* Conditional Filter Tabs */}
                            {filterType === 'poolwise' && matches[selectedRound]?.pools && (
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

                            {filterType === 'statuswise' && (
                                <div className={styles.statusTabs}>
                                    {['pending', 'on-going', 'completed'].map((status) => (
                                        <button
                                            key={status}
                                            data-status={status}
                                            className={`${styles.statusTab} ${selectedStatus === status ? styles.active : ''}`}
                                            onClick={() => setSelectedStatus(status === selectedStatus ? null : status)}
                                        >
                                            {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Matches Grid */}
                            <div className={styles.matchesGrid}>
                                {renderFilteredMatches()?.length === 0 ? (
                                    <div className={styles.noMatches}>No matches available</div>
                                ) : (
                                    renderMatches(renderFilteredMatches())
                                )}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default TournamentFixtures; 