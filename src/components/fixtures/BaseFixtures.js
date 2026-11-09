// Base component with common functionality
import React, { useEffect, useState } from 'react';
import styles from './Fixtures.module.scss';
import { endpoints } from '@/store/urls';
import { apiCall } from '@/store/utils';
import toast from 'react-hot-toast';

const BaseFixtures = ({ 
    matches: externalMatches, 
    tournamentId,
    totalRounds,
    showCourtInfo = false
}) => {
    const [matches, setMatches] = useState({});
    const [loading, setLoading] = useState(false);
    const [selectedRound, setSelectedRound] = useState(null);
    const [selectedPoolId, setSelectedPoolId] = useState(null);
    const [selectedCourt, setSelectedCourt] = useState(null);

    useEffect(() => {
        if (externalMatches) {
            setMatches(externalMatches);
            return;
        }
        
        if (tournamentId) {
            fetchMatches();
        }
    }, [tournamentId, externalMatches]);

    useEffect(() => {
        if (matches && Object.keys(matches).length > 0) {
            const rounds = Object.keys(matches).sort((a, b) => Number(a) - Number(b));
            const lastRound = rounds[rounds.length - 1];
            setSelectedRound(lastRound);
        }
    }, [matches]);

    const fetchMatches = async () => {
        try {
            setLoading(true);
            const response = await apiCall(`${endpoints.getFixtures}?tournament_id=${tournamentId}`);
            
            if (response && response.matches) {
                const transformedData = transformMatchesData(response.matches);
                setMatches(transformedData);
            }
        } catch (error) {
            console.error('Error fetching matches:', error);
            toast.error('Failed to fetch matches');
        } finally {
            setLoading(false);
        }
    };

    const parseMatchResult = (result) => {
        if (!result) return { team1Score: 0, team2Score: 0 };
        
        const scores = result.split('-').map(Number);
        return {
            team1Score: scores[0] || 0,
            team2Score: scores[1] || 0
        };
    };

    const transformMatchesData = (matchesArray) => {
        const transformed = {};
        
        matchesArray.forEach(match => {
            const roundId = match.round_id.toString();
            if (!transformed[roundId]) {
                transformed[roundId] = {
                    round_name: match.round_name || `Round ${match.round_id}`,
                    pools: {}
                };
            }

            const poolId = match.pool || 'unassigned';
            if (!transformed[roundId].pools[poolId]) {
                transformed[roundId].pools[poolId] = [];
            }

            transformed[roundId].pools[poolId].push({
                ...match,
                round_name: match.round_name || `Round ${match.round_id}`,
                ...parseMatchResult(match.match_result),
                status: match.match_status?.status || 'pending',
                winner_team_id: match.match_status?.is_final ? match.match_status?.winner_team_id : null,
                outcome: match.match_status?.outcome,
                team1_id: match.team1?.team_id,
                team2_id: match.team2?.team_id,
                team1_checked_in: match.team1?.checked_in,
                team2_checked_in: match.team2?.checked_in
            });
        });

        return transformed;
    };

    const getFilteredMatches = () => {
        if (!matches || !selectedRound) return [];
        
        const roundData = matches[selectedRound];
        if (!roundData?.pools) return [];

        const allMatches = [];
        Object.entries(roundData.pools).forEach(([poolId, poolMatches]) => {
            if (!selectedPoolId || selectedPoolId === poolId) {
                poolMatches.forEach(match => {
                    if (!selectedCourt || match.court_number === selectedCourt) {
                        allMatches.push({
                            ...match,
                            round_name: roundData.round_name
                        });
                    }
                });
            }
        });
        return allMatches;
    };

    const handleRoundClick = (roundId) => {
        setSelectedRound(roundId);
        setSelectedPoolId(null);
    };

    const handlePoolClick = (poolId) => {
        setSelectedPoolId(poolId === selectedPoolId ? null : poolId);
    };

    return {
        matches,
        loading,
        selectedRound,
        selectedPoolId,
        selectedCourt,
        setSelectedCourt,
        getFilteredMatches,
        handleRoundClick,
        handlePoolClick,
        fetchMatches
    };
};

export default BaseFixtures; 